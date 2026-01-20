import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View, ActivityIndicator, Alert } from 'react-native';
import { X, Gift, CheckCircle } from 'lucide-react-native';
import { trpc } from '@/lib/trpc';

interface RedeemCodeModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function RedeemCodeModal({ visible, onClose }: RedeemCodeModalProps) {
  const [code, setCode] = useState('');
  const [redeemStatus, setRedeemStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [rewardMessage, setRewardMessage] = useState('');

  const redeemMutation = trpc.rewards.redeemCode.useMutation({
    onSuccess: (data) => {
      console.log('[RedeemCode] Success:', data);
      setRedeemStatus('success');
      setRewardMessage(data.message || 'Code redeemed successfully!');
      setCode('');
      setTimeout(() => {
        setRedeemStatus('idle');
        setRewardMessage('');
        onClose();
      }, 2500);
    },
    onError: (error) => {
      console.error('[RedeemCode] Error:', error);
      setRedeemStatus('error');
      setRewardMessage(error.message || 'Invalid or expired code');
      setTimeout(() => {
        setRedeemStatus('idle');
        setRewardMessage('');
      }, 2500);
    },
  });

  const handleRedeem = () => {
    if (!code.trim()) {
      Alert.alert('Error', 'Please enter a code');
      return;
    }
    redeemMutation.mutate({ code: code.trim().toUpperCase() });
  };

  const handleClose = () => {
    if (!redeemMutation.isPending) {
      setCode('');
      setRedeemStatus('idle');
      setRewardMessage('');
      onClose();
    }
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modal}>
              <View style={styles.header}>
                <View style={styles.iconContainer}>
                  <Gift size={24} color="#8B5CF6" />
                </View>
                <Text style={styles.title}>Redeem a Code</Text>
                <TouchableOpacity 
                  onPress={handleClose} 
                  style={styles.closeButton}
                  disabled={redeemMutation.isPending}
                >
                  <X size={24} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              <Text style={styles.description}>
                Enter your promotional code to unlock exclusive rewards, coins, or special items!
              </Text>

              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  value={code}
                  onChangeText={setCode}
                  placeholder="Enter code here"
                  placeholderTextColor="#475569"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  editable={!redeemMutation.isPending && redeemStatus === 'idle'}
                  maxLength={20}
                />
              </View>

              {redeemStatus === 'success' && (
                <View style={styles.statusContainer}>
                  <CheckCircle size={20} color="#10B981" />
                  <Text style={styles.successText}>{rewardMessage}</Text>
                </View>
              )}

              {redeemStatus === 'error' && (
                <View style={[styles.statusContainer, styles.errorContainer]}>
                  <X size={20} color="#EF4444" />
                  <Text style={styles.errorText}>{rewardMessage}</Text>
                </View>
              )}

              <View style={styles.buttonContainer}>
                <TouchableOpacity 
                  style={styles.cancelButton} 
                  onPress={handleClose}
                  disabled={redeemMutation.isPending}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[
                    styles.redeemButton,
                    (redeemMutation.isPending || !code.trim()) && styles.redeemButtonDisabled
                  ]} 
                  onPress={handleRedeem}
                  disabled={redeemMutation.isPending || !code.trim()}
                >
                  {redeemMutation.isPending ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.redeemButtonText}>Redeem</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    width: '85%',
    maxWidth: 420,
    backgroundColor: '#0F1520',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 24,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.30,
    shadowRadius: 4.65,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#8B5CF6',
    opacity: 0.15,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    left: 0,
  },
  title: {
    flex: 1,
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFF',
    paddingLeft: 60,
  },
  closeButton: {
    padding: 4,
  },
  description: {
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 20,
    marginBottom: 24,
  },
  inputContainer: {
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#FFF',
    fontWeight: '600',
    letterSpacing: 1,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    opacity: 0.15,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorContainer: {
    backgroundColor: '#EF4444',
  },
  successText: {
    flex: 1,
    fontSize: 14,
    color: '#10B981',
    fontWeight: '600',
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '600',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94A3B8',
  },
  redeemButton: {
    flex: 1,
    backgroundColor: '#8B5CF6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  redeemButtonDisabled: {
    backgroundColor: '#4C1D95',
    opacity: 0.5,
  },
  redeemButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
});
