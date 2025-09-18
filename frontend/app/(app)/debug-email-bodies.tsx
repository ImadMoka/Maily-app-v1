import React from 'react';
import { View, Text, StyleSheet, FlatList, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { withObservables } from '@nozbe/watermelondb/react';
import { database } from '../../src/database';
import { EmailBody } from '../../src/database/models/EmailBody';
import { syncNow } from '../../src/database/sync';
import { colors } from '../../src/constants';

// Debug component to show all email bodies
const DebugEmailBodiesContent = withObservables([], () => ({
  emailBodies: database.collections.get<EmailBody>('email_body').query().observe(),
}))(({ emailBodies }: { emailBodies: EmailBody[] }) => {
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await syncNow();
      console.log('Sync completed');
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const renderEmailBody = ({ item }: { item: EmailBody }) => {
    const bodyPreview = item.body ?
      (item.body.length > 200 ? item.body.substring(0, 200) + '...' : item.body)
      : 'No body content';

    return (
      <View style={styles.card}>
        <Text style={styles.idText}>ID: {item.id}</Text>
        <Text style={styles.emailIdText}>Email ID: {item.emailId}</Text>
        <View style={styles.divider} />
        <ScrollView style={styles.bodyContainer}>
          <Text style={styles.bodyText}>{bodyPreview}</Text>
        </ScrollView>
        <Text style={styles.lengthText}>
          Body Length: {item.body?.length || 0} characters
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.content}>
      <View style={styles.statsBar}>
        <Text style={styles.statsText}>
          Total Email Bodies: {emailBodies.length}
        </Text>
        <TouchableOpacity style={styles.syncButton} onPress={onRefresh}>
          <Text style={styles.syncButtonText}>Sync</Text>
        </TouchableOpacity>
      </View>

      {emailBodies.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No email bodies in database</Text>
          <Text style={styles.emptySubtext}>Pull to refresh or tap Sync to fetch data</Text>
        </View>
      ) : (
        <FlatList
          data={emailBodies}
          keyExtractor={(item) => item.id}
          renderItem={renderEmailBody}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
    </View>
  );
});

export default function DebugEmailBodiesScreen() {
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Debug: Email Bodies</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Content */}
      <DebugEmailBodiesContent />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.secondary,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.secondary,
    borderRadius: 20,
  },
  backButtonText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 80,
  },
  content: {
    flex: 1,
  },
  statsBar: {
    backgroundColor: '#f0f0f0',
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statsText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  syncButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  syncButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  list: {
    padding: 16,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  idText: {
    fontSize: 10,
    color: '#666',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  emailIdText: {
    fontSize: 11,
    color: '#888',
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 8,
  },
  bodyContainer: {
    maxHeight: 100,
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 13,
    color: colors.primary,
    lineHeight: 18,
  },
  lengthText: {
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: colors.primary,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});