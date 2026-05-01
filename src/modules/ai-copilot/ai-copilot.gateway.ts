import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth/auth.service';
import { AiCopilotService } from './ai-copilot.service';

interface CopilotSocket extends Socket {
  user?: {
    userId: string;
    tenantId: string;
    role: string;
    permissions: string[];
    email: string;
  };
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split(';').map((c) => {
      const [key, ...rest] = c.trim().split('=');
      return [key, rest.join('=')];
    }),
  );
}

@WebSocketGateway({ namespace: 'copilot', cors: { origin: true, credentials: true } })
export class AiCopilotGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(AiCopilotGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private copilotService: AiCopilotService,
    private jwtService: JwtService,
    private config: ConfigService,
    private authService: AuthService,
  ) {}

  afterInit() {
    this.logger.log('Copilot WebSocket gateway initialized');
  }

  async handleConnection(client: CopilotSocket) {
    try {
      const cookies = parseCookies(client.handshake.headers.cookie);
      const portal = client.handshake.headers['x-portal-type'] as string;
      const primaryCookie = portal === 'internal' ? 'internal_access_token' : 'customer_access_token';
      const token =
        (client.handshake.auth as Record<string, string>)?.token ??
        client.handshake.headers?.authorization?.replace('Bearer ', '') ??
        cookies[primaryCookie] ??
        cookies['access_token'];

      if (!token) {
        throw new UnauthorizedException('Missing token');
      }

      const payload = this.jwtService.verify<{
        sub: string;
        tenantId: string;
        email: string;
        role: string;
      }>(token, { secret: this.config.get<string>('JWT_SECRET') });

      const fullUser = await this.authService.validateUserById(payload.sub);

      client.user = {
        userId: payload.sub,
        tenantId: payload.tenantId,
        role: payload.role,
        permissions: fullUser.permissions,
        email: payload.email,
      };

      this.logger.log(`Copilot client authenticated: ${payload.sub}`);
    } catch (err: any) {
      this.logger.warn(`Copilot auth failed: ${err.message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: CopilotSocket) {
    this.logger.log(`Copilot client disconnected: ${client.id}`);
  }

  @SubscribeMessage('copilot:chat')
  async handleChat(
    @MessageBody() data: { conversationId: string; message: string },
    @ConnectedSocket() client: CopilotSocket,
  ) {
    if (!client.user) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    try {
      const result = await this.copilotService.sendMessage(
        data.conversationId,
        data.message,
        client.user,
      );

      for (const msg of result.messages) {
        client.emit('copilot:message', msg);
      }

      client.emit('copilot:done', { conversationId: data.conversationId });
    } catch (err: any) {
      this.logger.error(`Chat error: ${err.message}`);
      client.emit('copilot:error', { message: err.message ?? 'Chat failed' });
    }
  }

  @SubscribeMessage('copilot:chat_stream')
  async handleChatStream(
    @MessageBody() data: { conversationId: string; message: string; context?: Record<string, unknown> },
    @ConnectedSocket() client: CopilotSocket,
  ) {
    if (!client.user) {
      client.emit('copilot:error', { message: 'Not authenticated' });
      return;
    }

    try {
      await this.copilotService.sendMessageStream(
        data.conversationId,
        data.message,
        client.user,
        (event) => client.emit('copilot:stream', event),
        data.context,
      );
      client.emit('copilot:done', { conversationId: data.conversationId });
    } catch (err: any) {
      this.logger.error(`Stream error: ${err.message}`);
      client.emit('copilot:error', { message: err.message ?? 'Stream failed' });
    }
  }

  @SubscribeMessage('copilot:execute-draft')
  async handleExecuteDraft(
    @MessageBody() data: { conversationId: string; tool: string; payload: Record<string, unknown> },
    @ConnectedSocket() client: CopilotSocket,
  ) {
    if (!client.user) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    try {
      const result = await this.copilotService.executeDraft(
        data.conversationId,
        data.tool,
        data.payload,
        client.user,
      );
      client.emit('copilot:draft-result', { conversationId: data.conversationId, result });
    } catch (err: any) {
      this.logger.error(`Draft execution error: ${err.message}`);
      client.emit('copilot:error', { message: err.message ?? 'Draft execution failed' });
    }
  }
}
