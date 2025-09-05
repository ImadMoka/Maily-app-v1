import { SimpleEmailService } from '@/services/email/email.service';

export class SimpleEmailRoutes {
  private emailService = new SimpleEmailService();

  async handleEmailFetch(request: Request): Promise<Response> {
    try {
      const body = await request.json();
      
      if (!body.email || !body.password) {
        return Response.json({
          success: false,
          error: 'Email and password required'
        }, { status: 400 });
      }

      const result = await this.emailService.fetchEmails(
        body.email,
        body.password,
        body.emailCount || 100
      );

      if (result.success) {
        return Response.json({
          success: true,
          count: result.emails?.length || 0,
          emails: result.emails
        });
      } else {
        return Response.json({
          success: false,
          error: result.error
        }, { status: 400 });
      }

    } catch (error) {
      return Response.json({
        success: false,
        error: 'Invalid request'
      }, { status: 400 });
    }
  }
}