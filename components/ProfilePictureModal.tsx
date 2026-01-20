import { Modal, View, Text, StyleSheet, Image, TouchableOpacity, Dimensions } from 'react-native';
import { X, Trash2, Image as ImageIcon } from 'lucide-react-native';

interface ProfilePictureModalProps {
  visible: boolean;
  onClose: () => void;
  imageUrl: string | null;
  username: string;
  onRemove?: () => void;
  viewOnly?: boolean;
}

const { width } = Dimensions.get('window');

export default function ProfilePictureModal({ 
  visible, 
  onClose, 
  imageUrl, 
  username,
  onRemove,
  viewOnly = false,
}: ProfilePictureModalProps) {
  const hasImage = !!imageUrl;

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
            <Text style={styles.title}>Profile Picture</Text>
            <TouchableOpacity 
              style={styles.closeButton} 
              onPress={onClose}
            >
              <X size={24} color="#FFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <View style={styles.largeImageContainer}>
              {hasImage ? (
                <Image 
                  source={{ uri: imageUrl }} 
                  style={styles.largeProfileImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.placeholderContainer}>
                  <ImageIcon size={64} color="#475569" />
                  <Text style={styles.placeholderText}>No profile picture</Text>
                </View>
              )}
            </View>
            
            {!viewOnly && hasImage && onRemove && (
              <TouchableOpacity 
                style={[styles.actionButton, styles.removeButton]}
                onPress={onRemove}
              >
                <Trash2 size={20} color="#FFF" />
                <Text style={styles.actionButtonText}>Remove</Text>
              </TouchableOpacity>
            )}
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
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  largeImageContainer: {
    width: width * 0.7,
    height: width * 0.7,
    borderRadius: (width * 0.7) / 2,
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: '#4ADE80',
    backgroundColor: '#1E293B',
    position: 'relative',
  },
  largeProfileImage: {
    width: '100%',
    height: '100%',
  },

  placeholderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  placeholderText: {
    color: '#64748B',
    fontSize: 16,
    fontWeight: '500' as const,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    marginTop: 32,
    minWidth: 160,
  },

  removeButton: {
    backgroundColor: '#EF4444',
  },

  actionButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700' as const,
  },

});
