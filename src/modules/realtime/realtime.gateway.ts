import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: (origin: string, cb: (err: Error | null, allow?: boolean) => void) => {
      // Defer to the allowlist resolved at init time; stored on the instance
      const gateway = RealtimeGateway.instance;
      if (!gateway || gateway.isOriginAllowed(origin)) {
        cb(null, true);
      } else {
        cb(new Error('Origin not allowed'), false);
      }
    },
    credentials: true,
  },
  namespace: '/',
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  /** Static reference so the CORS callback (called outside the instance) can reach it. */
  static instance: RealtimeGateway;

  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);
  private allowedOrigins: string[] = [];

  constructor(
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
  ) {
    RealtimeGateway.instance = this;
  }

  afterInit() {
    this.allowedOrigins = this.config
      .get<string>('ALLOWED_ORIGINS', 'http://localhost:3000,http://localhost:3001')
      .split(',')
      .map((o) => o.trim());
    this.logger.log('WebSocket gateway initialised');
  }

  isOriginAllowed(origin: string | undefined): boolean {
    if (!origin) return true; // same-origin / server-to-server
    return this.allowedOrigins.includes(origin);
  }

  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth as Record<string, string>)?.token ??
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        throw new UnauthorizedException('Missing token');
      }

      const payload = this.jwtService.verify<{
        sub: string;
        tenantId: string;
        email: string;
        role: string;
      }>(token, { secret: this.config.get<string>('JWT_SECRET') });

      const userId = payload.sub;
      const tenantId = payload.tenantId;

      // Attach verified identity to the socket for downstream use
      (client as any).user = { userId, tenantId, email: payload.email, role: payload.role };

      client.join(`user:${userId}`);
      client.join(`tenant:${tenantId}`);

      this.logger.log(
        `WS connected: ${client.id} | user=${userId} | tenant=${tenantId}`,
      );
    } catch (err) {
      this.logger.warn(`WS rejected: ${client.id} — ${(err as Error).message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`WS disconnected: ${client.id}`);
  }

  /** Broadcast to everyone in a tenant (e.g. ticket created/updated) */
  emitToTenant(tenantId: string, event: string, data: unknown) {
    this.server?.to(`tenant:${tenantId}`).emit(event, data);
  }

  /** Emit to a specific user only (e.g. assigned to you) */
  emitToUser(userId: string, event: string, data: unknown) {
    this.server?.to(`user:${userId}`).emit(event, data);
  }
}
