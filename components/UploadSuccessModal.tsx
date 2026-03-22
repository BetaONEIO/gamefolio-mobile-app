import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TouchableOpacity,
  Animated
} from 'react-native';
import { Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

interface UploadSuccessModalProps {
  visible: boolean;
  onClose: () => void;
  contentType: 'clip' | 'reel' | 'screenshot';
  title: string;
  gameName: string;
}

export default function UploadSuccessModal({ 
  visible, 
  onClose, 
  contentType,
  title,
  gameName
}: UploadSuccessModalProps) {
  const scaleAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }).start();
    } else {
      scaleAnim.setValue(0);
    }
  }, [visible, scaleAnim]);

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  const getContentLabel = () => {
    switch (contentType) {
      case 'clip': return 'clip';
      case 'reel': return 'reel';
      case 'screenshot': return 'screenshot';
      default: return 'content';
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity 
          style={styles.backdrop} 
          activeOpacity={1} 
          onPress={handleClose} 
        />
        
        <Animated.View 
          style={[
            styles.modalContainer,
            { transform: [{ scale: scaleAnim }] }
          ]}
        >
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <Check size={32} color="#4ADE80" strokeWidth={3} />
            </View>
          </View>

          <Text style={styles.title}>Upload Successful!</Text>
          
          <Text style={styles.message}>
            Your {getContentLabel()} has been uploaded successfully!
          </Text>

          <View style={styles.detailsContainer}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Title:</Text>
              <Text style={styles.detailValue} numberOfLines={1}>{title}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Game:</Text>
              <Text style={styles.detailValue} numberOfLines={1}>{gameName}</Text>
            </View>
          </View>

          <TouchableOpacity 
            style={styles.continueButton}
            onPress={handleClose}
            activeOpacity={0.8}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },
  modalContainer: {
    width: '85%',
    maxWidth: 360,
    backgroundColor: '#131F2A',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 28,
    alignItems: 'center',
    shadowColor: "#4ADE80",
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    marginBottom: 20,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
    borderWidth: 2,
    borderColor: '#4ADE80',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  detailsContainer: {
    width: '100%',
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  detailLabel: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '500',
  },
  detailValue: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
    marginLeft: 12,
  },
  continueButton: {
    width: '100%',
    backgroundColor: '#4ADE80',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  continueButtonText: {
    color: '#002E15',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
