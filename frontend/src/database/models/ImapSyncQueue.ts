import { Model } from '@nozbe/watermelondb'
import { field, date, readonly } from '@nozbe/watermelondb/decorators'

export type OperationType = 'mark_read' | 'mark_unread'
export type QueueStatus = 'pending' | 'processing' | 'failed'

export default class ImapSyncQueue extends Model {
  static table = 'imap_sync_queue'

  @field('email_id') emailId!: string
  @field('imap_uid') imapUid!: number
  @field('operation_type') operationType!: OperationType
  @field('folder_name') folderName!: string
  @field('account_id') accountId!: string
  @field('attempts') attempts!: number
  @field('last_error') lastError?: string
  @field('status') status!: QueueStatus
  @readonly @date('created_at') createdAt!: Date
  @readonly @date('updated_at') updatedAt!: Date
}