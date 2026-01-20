import React from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  Modal, 
  TouchableWithoutFeedback, 
  Pressable
} from 'react-native';
import { Video, Film, Image as ImageIcon } from 'lucide-react-native';
import { useRouter } from 'expo-router';

interface UploadDropdownProps {
  visible: boolean;
  onClose: () => void;
  topOffset: number;
}

export default function UploadDropdown({ visible, onClose, topOffset }: UploadDropdownProps) {
  const router = useRouter();

  const handleSelect = (type: 'clips' | 'reels' | 'screenshots') => {
    onClose();
    router.push(`/create?type=${type}`);
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.dropdown, { top: topOffset }]}>
              <Pressable 
                style={({ pressed, hovered }: any) => [
                  styles.option, 
                  (pressed || hovered) && styles.optionPressed
                ]}
                onPress={() => handleSelect('clips')}
              >
                <Video size={20} color="#FFF" style={styles.icon} />
                <Text style={styles.optionText}>Upload Clip</Text>
              </Pressable>
              
              <Pressable 
                style={({ pressed, hovered }: any) => [
                  styles.option, 
                  (pressed || hovered) && styles.optionPressed
                ]}
                onPress={() => handleSelect('reels')}
              >
                <Film size={20} color="#FFF" style={styles.icon} />
                <Text style={styles.optionText}>Upload Reel</Text>
              </Pressable>
              
              <Pressable 
                style={({ pressed, hovered }: any) => [
                  styles.option, 
                  styles.lastOption, 
                  (pressed || hovered) && styles.optionPressed
                ]}
                onPress={() => handleSelect('screenshots')}
              >
                <ImageIcon size={20} color="#FFF" style={styles.icon} />
                <Text style={styles.optionText}>Upload Screenshots</Text>
              </Pressable>
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
    backgroundColor: 'transparent',
  },
  dropdown: {
    position: 'absolute',
    right: 70, // Positioned near the add button
    width: 200,
    backgroundColor: '#0F1520',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.30,
    shadowRadius: 4.65,
    elevation: 8,
    overflow: 'hidden',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  optionPressed: {
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
  },
  lastOption: {
    borderBottomWidth: 0,
  },
  icon: {
    marginRight: 12,
  },
  optionText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
