import { Modal, View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { X, Image as ImageIcon } from 'lucide-react-native';

interface ProfileBannerModalProps {
  visible: boolean;
  onClose: () => void;
  bannerUrl?: string;
  username: string;
}

export default function ProfileBannerModal({ visible, onClose, bannerUrl, username }: ProfileBannerModalProps) {
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.centeredView}>
        <View style={styles.backdrop} onTouchEnd={onClose} />
        
        <View style={styles.modalView}>
          <View style={styles.header}>
            <Text style={styles.title}>Profile Banner</Text>
            <TouchableOpacity 
              style={styles.closeButton} 
              onPress={onClose}
            >
              <X size={24} color="#FFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.previewSection}>
            <View style={styles.imageContainer}>
              {bannerUrl ? (
                <Image 
                  source={{ uri: bannerUrl }} 
                  style={styles.bannerImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.bannerPlaceholder}>
                  <ImageIcon size={48} color="#334155" />
                  <Text style={styles.placeholderText}>No banner set</Text>
                </View>
              )}
            </View>
            <Text style={styles.username}>{username}</Text>
            <Text style={styles.hint}>Current profile banner</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  modalView: {
    height: '85%',
    backgroundColor: '#0F1520',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  title: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: 'bold' as const,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 16/9,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: '#4ADE80',
    backgroundColor: '#1E293B',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  username: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold' as const,
    textAlign: 'center',
    marginTop: 16,
  },
  hint: {
    marginTop: 8,
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },
  bannerPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  placeholderText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '500' as const,
  },
});
