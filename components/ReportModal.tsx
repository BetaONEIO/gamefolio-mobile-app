import React, { useState } from 'react';
import { 
  Modal, 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  TextInput,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { X, AlertTriangle, Check } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

export type ReportType = 'clip' | 'user' | 'screenshot' | 'comment';

export interface ReportReason {
  id: string;
  label: string;
  description: string;
}

const REPORT_REASONS: ReportReason[] = [
  {
    id: 'spam',
    label: 'Spam',
    description: 'Misleading or repetitive content',
  },
  {
    id: 'inappropriate',
    label: 'Inappropriate Content',
    description: 'Nudity, violence, or disturbing content',
  },
  {
    id: 'harassment',
    label: 'Harassment or Bullying',
    description: 'Targeting or attacking individuals',
  },
  {
    id: 'hate_speech',
    label: 'Hate Speech',
    description: 'Promoting hatred against groups',
  },
  {
    id: 'copyright',
    label: 'Copyright Violation',
    description: 'Using content without permission',
  },
  {
    id: 'impersonation',
    label: 'Impersonation',
    description: 'Pretending to be someone else',
  },
  {
    id: 'other',
    label: 'Other',
    description: 'Something else not listed above',
  },
];

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (reason: string, details: string) => Promise<void>;
  contentType: ReportType;
  contentId: string | number;
  contentTitle?: string;
}

export default function ReportModal({
  visible,
  onClose,
  onSubmit,
  contentType,
  contentTitle,
}: ReportModalProps) {
  const insets = useSafeAreaInsets();
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [additionalDetails, setAdditionalDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSelectReason = (reasonId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedReason(reasonId);
  };

  const handleSubmit = async () => {
    if (!selectedReason) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSubmitting(true);
    
    try {
      await onSubmit(selectedReason, additionalDetails);
      setIsSubmitted(true);
      
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (error) {
      console.error('[ReportModal] Error submitting report:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedReason(null);
    setAdditionalDetails('');
    setIsSubmitted(false);
    onClose();
  };

  const getContentTypeLabel = () => {
    switch (contentType) {
      case 'clip': return 'clip';
      case 'user': return 'user';
      case 'screenshot': return 'screenshot';
      case 'comment': return 'comment';
      default: return 'content';
    }
  };

  if (isSubmitted) {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        transparent
        onRequestClose={handleClose}
      >
        <View style={styles.overlay}>
          <View style={[styles.container, styles.successContainer]}>
            <View style={styles.successIconWrapper}>
              <Check size={48} color="#4ADE80" />
            </View>
            <Text style={styles.successTitle}>Report Submitted</Text>
            <Text style={styles.successMessage}>
              Thank you for helping keep our community safe. We will review your report and take appropriate action.
            </Text>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={[styles.container, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <AlertTriangle size={24} color="#F59E0B" />
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={styles.title}>Report {getContentTypeLabel()}</Text>
              {contentTitle && (
                <Text style={styles.subtitle} numberOfLines={1}>
                  &ldquo;{contentTitle}&rdquo;
                </Text>
              )}
            </View>
            <TouchableOpacity 
              onPress={handleClose} 
              style={styles.closeButton}
              activeOpacity={0.7}
            >
              <X size={24} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Why are you reporting this?</Text>

          <ScrollView 
            style={styles.reasonsList}
            showsVerticalScrollIndicator={false}
          >
            {REPORT_REASONS.map((reason) => (
              <TouchableOpacity
                key={reason.id}
                style={[
                  styles.reasonItem,
                  selectedReason === reason.id && styles.reasonItemSelected,
                ]}
                onPress={() => handleSelectReason(reason.id)}
                activeOpacity={0.7}
              >
                <View style={styles.reasonRadio}>
                  {selectedReason === reason.id && (
                    <View style={styles.reasonRadioInner} />
                  )}
                </View>
                <View style={styles.reasonContent}>
                  <Text style={styles.reasonLabel}>{reason.label}</Text>
                  <Text style={styles.reasonDescription}>{reason.description}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {selectedReason && (
            <View style={styles.detailsContainer}>
              <Text style={styles.detailsLabel}>Additional details (optional)</Text>
              <TextInput
                style={styles.detailsInput}
                placeholder="Provide more context about this report..."
                placeholderTextColor="#64748B"
                value={additionalDetails}
                onChangeText={setAdditionalDetails}
                multiline
                numberOfLines={3}
                maxLength={500}
              />
              <Text style={styles.charCount}>{additionalDetails.length}/500</Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.submitButton,
              !selectedReason && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!selectedReason || isSubmitting}
            activeOpacity={0.8}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={styles.submitButtonText}>Submit Report</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.disclaimer}>
            False reports may result in action against your account. Reports are reviewed by our team within 24-48 hours.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#0F1520',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    maxHeight: '90%',
  },
  successContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  successIconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#FFF',
    marginBottom: 12,
  },
  successMessage: {
    fontSize: 15,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#FFF',
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 2,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#1E293B',
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFF',
    marginBottom: 12,
  },
  reasonsList: {
    maxHeight: 280,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  reasonItemSelected: {
    borderColor: '#4ADE80',
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
  },
  reasonRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#475569',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  reasonRadioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4ADE80',
  },
  reasonContent: {
    flex: 1,
  },
  reasonLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFF',
    marginBottom: 2,
  },
  reasonDescription: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
  },
  detailsContainer: {
    marginTop: 16,
  },
  detailsLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#CBD5E1',
    marginBottom: 8,
  },
  detailsInput: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 14,
    color: '#FFF',
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'right',
    marginTop: 6,
  },
  submitButton: {
    backgroundColor: '#EF4444',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  submitButtonDisabled: {
    backgroundColor: '#475569',
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700' as const,
  },
  disclaimer: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
});
