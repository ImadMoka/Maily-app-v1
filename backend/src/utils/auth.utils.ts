import { supabaseAdmin, supabase } from '../libs/supabase'
import type { User } from '@supabase/supabase-js'

export interface AuthResult {
  success: boolean
  user?: User
  error?: string
}

export class AuthUtils {
  
  static async validateToken(authHeader?: string): Promise<AuthResult> {
    // Check if Authorization header exists
    if (!authHeader) {
      return {
        success: false,
        error: 'Authorization header required'
      }
    }

    // Check if it's a Bearer token
    if (!authHeader.startsWith('Bearer ')) {
      return {
        success: false,
        error: 'Bearer token required'
      }
    }

    // Extract the token
    const token = authHeader.replace('Bearer ', '')
    if (!token) {
      return {
        success: false,
        error: 'Token missing from Authorization header'
      }
    }

    try {
      // Validate token with Supabase admin client
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
      
      if (error) {
        return {
          success: false,
          error: `Token validation failed: ${error.message}`
        }
      }

      if (!user) {
        return {
          success: false,
          error: 'No user found for provided token'
        }
      }

      return {
        success: true,
        user: user
      }

    } catch (err) {
      return {
        success: false,
        error: `Authentication error: ${err}`
      }
    }
  }

  static createUnauthorizedResponse(message?: string): Response {
    return Response.json({
      success: false,
      error: message || 'Unauthorized'
    }, { status: 401 })
  }

  static async createUserClient(token: string) {
    // Create a client that operates with the user's permissions (RLS enforced)
    const userClient = supabase
    await userClient.auth.setSession({ 
      access_token: token, 
      refresh_token: null 
    })
    return userClient
  }
}