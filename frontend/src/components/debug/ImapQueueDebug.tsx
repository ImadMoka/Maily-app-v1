import React from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native'
import { withObservables } from '@nozbe/watermelondb/react'
import { database } from '../../database'
import ImapSyncQueue from '../../database/models/ImapSyncQueue'
import { Q } from '@nozbe/watermelondb'

interface QueueDebugProps {
  queueItems: ImapSyncQueue[]
}

const ImapQueueDebugComponent: React.FC<QueueDebugProps> = ({ queueItems }) => {
  const [refreshing, setRefreshing] = React.useState(false)

  const onRefresh = React.useCallback(() => {
    setRefreshing(true)
    setTimeout(() => setRefreshing(false), 500)
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#FFA500'
      case 'processing': return '#4169E1'
      case 'failed': return '#FF0000'
      default: return '#808080'
    }
  }

  const clearQueue = async () => {
    await database.write(async () => {
      const allItems = await database.get<ImapSyncQueue>('imap_sync_queue').query().fetch()
      for (const item of allItems) {
        await item.markAsDeleted()
      }
    })
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📮 IMAP Sync Queue</Text>
        <TouchableOpacity onPress={clearQueue} style={styles.clearButton}>
          <Text style={styles.clearButtonText}>Clear All</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.count}>
        Total items: {queueItems.length}
      </Text>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {queueItems.length === 0 ? (
          <Text style={styles.emptyText}>Queue is empty</Text>
        ) : (
          queueItems.map((item, index) => (
            <View key={item.id} style={styles.queueItem}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemIndex}>#{index + 1}</Text>
                <View
                  style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}
                >
                  <Text style={styles.statusText}>{item.status}</Text>
                </View>
              </View>

              <Text style={styles.itemDetail}>
                <Text style={styles.label}>Operation:</Text> {item.operationType}
              </Text>
              <Text style={styles.itemDetail}>
                <Text style={styles.label}>IMAP UID:</Text> {item.imapUid}
              </Text>
              <Text style={styles.itemDetail}>
                <Text style={styles.label}>Folder:</Text> {item.folderName}
              </Text>
              <Text style={styles.itemDetail}>
                <Text style={styles.label}>Attempts:</Text> {item.attempts}/3
              </Text>
              {item.lastError && (
                <Text style={styles.errorText}>
                  <Text style={styles.label}>Error:</Text> {item.lastError}
                </Text>
              )}
              <Text style={styles.timestamp}>
                Created: {new Date(item.createdAt).toLocaleTimeString()}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    padding: 15,
    margin: 10,
    maxHeight: 400,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  clearButton: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 5,
  },
  clearButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  count: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  scrollView: {
    maxHeight: 300,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
    paddingVertical: 20,
  },
  queueItem: {
    backgroundColor: 'white',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemIndex: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  itemDetail: {
    fontSize: 12,
    color: '#333',
    marginBottom: 4,
  },
  label: {
    fontWeight: 'bold',
    color: '#666',
  },
  errorText: {
    fontSize: 11,
    color: '#FF0000',
    marginTop: 4,
  },
  timestamp: {
    fontSize: 10,
    color: '#999',
    marginTop: 6,
  },
})

// Connect to WatermelonDB observables
const enhance = withObservables([], () => ({
  queueItems: database.get<ImapSyncQueue>('imap_sync_queue')
    .query(Q.sortBy('created_at', Q.desc))
    .observe()
}))

export const ImapQueueDebug = enhance(ImapQueueDebugComponent)