import React, { useState, useEffect } from 'react';
import { 
  Modal, 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet,
  Platform,
  TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ChevronLeft, Cake, Calendar } from 'lucide-react-native';

interface BirthdayModalProps {
  visible: boolean;
  onClose: () => void;
  onContinue: (date: Date) => void;
  initialDate?: Date | null;
}

export default function BirthdayModal({ 
  visible, 
  onClose, 
  onContinue,
  initialDate 
}: BirthdayModalProps) {
  const [date, setDate] = useState(initialDate || new Date());
  const [showPicker, setShowPicker] = useState(false);
  
  const [textValue, setTextValue] = useState(() => {
    try {
      return (initialDate || new Date()).toISOString().split('T')[0];
    } catch {
      return new Date().toISOString().split('T')[0];
    }
  });

  useEffect(() => {
    if (visible) {
      const d = initialDate || new Date();
      setDate(d);
      try {
        setTextValue(d.toISOString().split('T')[0]);
      } catch {
        setTextValue(new Date().toISOString().split('T')[0]);
      }
    }
  }, [visible, initialDate]);

  const colors = {
    background: '#0F1520',
    primary: '#4ADE80',
    secondary: '#1E293B',
    surface: '#1A2332',
    surfaceHighlight: '#243044',
    text: '#FFFFFF',
    textDim: '#94A3B8',
    border: '#334155',
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }
    if (selectedDate) {
      setDate(selectedDate);
      try {
        setTextValue(selectedDate.toISOString().split('T')[0]);
      } catch {
        // ignore
      }
    }
  };

  const handleWebDateChange = (text: string) => {
    setTextValue(text);
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      const newDate = new Date(text);
      if (!isNaN(newDate.getTime())) {
        setDate(newDate);
      }
    }
  };

  const formatDisplayDate = (d: Date) => {
    return d.toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.backButton}>
              <ChevronLeft size={28} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <View style={styles.titleContainer}>
              <View style={styles.iconWrapper}>
                <Cake size={32} color={colors.primary} />
              </View>
              <Text style={[styles.title, { color: colors.text }]}>
                When&apos;s your birthday?
              </Text>
              <Text style={[styles.subtitle, { color: colors.textDim }]}>
                Your birthday won&apos;t be shown publicly. Tap the date below to change it.
              </Text>
            </View>

            <TouchableOpacity 
              style={[styles.displayField, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setShowPicker(true)}
              activeOpacity={0.7}
            >
              <Calendar size={20} color={colors.primary} />
              <Text style={[styles.dateText, { color: colors.text }]}>
                {formatDisplayDate(date)}
              </Text>
              <Text style={[styles.tapHint, { color: colors.textDim }]}>Tap to change</Text>
            </TouchableOpacity>

            {Platform.OS === 'web' && showPicker && (
              <Modal
                visible={showPicker}
                transparent
                animationType="fade"
                onRequestClose={() => setShowPicker(false)}
              >
                <TouchableOpacity 
                  style={styles.pickerOverlay}
                  activeOpacity={1}
                  onPress={() => setShowPicker(false)}
                >
                  <TouchableOpacity 
                    activeOpacity={1} 
                    style={[styles.pickerModal, { backgroundColor: colors.surface }]}
                  >
                    <Text style={[styles.pickerModalTitle, { color: colors.text }]}>Select Date</Text>
                    <TextInput
                      value={textValue}
                      onChangeText={handleWebDateChange}
                      style={[styles.webInput, { 
                        backgroundColor: colors.surfaceHighlight,
                        color: colors.text,
                        borderColor: colors.border,
                      }]}
                      // @ts-ignore - web only prop
                      type="date"
                      max={new Date().toISOString().split('T')[0]}
                    />
                    <TouchableOpacity 
                      style={[styles.pickerDoneButton, { backgroundColor: colors.primary }]}
                      onPress={() => setShowPicker(false)}
                    >
                      <Text style={styles.pickerDoneText}>Done</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                </TouchableOpacity>
              </Modal>
            )}

            {Platform.OS === 'ios' && showPicker && (
              <View style={[styles.iosPickerContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.iosPickerHeader}>
                  <TouchableOpacity onPress={() => setShowPicker(false)}>
                    <Text style={[styles.iosPickerDone, { color: colors.primary }]}>Done</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={date}
                  mode="date"
                  display="spinner"
                  onChange={handleDateChange}
                  textColor={colors.text}
                  themeVariant="dark"
                  maximumDate={new Date()}
                  style={styles.picker}
                />
              </View>
            )}

            {Platform.OS === 'android' && showPicker && (
              <DateTimePicker
                value={date}
                mode="date"
                display="default"
                onChange={handleDateChange}
                maximumDate={new Date()}
              />
            )}

            <View style={{ flex: 1 }} />

            <TouchableOpacity 
              style={[styles.button, { backgroundColor: colors.primary }]}
              onPress={() => onContinue(date)}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  titleContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 32,
  },
  iconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  displayField: {
    height: 60,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderWidth: 1.5,
    gap: 12,
  },
  dateText: {
    fontSize: 17,
    fontWeight: '600' as const,
    flex: 1,
  },

  picker: {
    width: '100%',
    height: 180,
  },
  tapHint: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerModal: {
    width: '85%',
    maxWidth: 340,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  pickerModalTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    marginBottom: 20,
  },
  webInput: {
    padding: 16,
    fontSize: 18,
    borderRadius: 12,
    borderWidth: 1,
    width: '100%',
    maxWidth: 320,
    height: 56,
    textAlign: 'center',
  },
  pickerDoneButton: {
    marginTop: 20,
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 25,
  },
  pickerDoneText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#002E15',
  },
  iosPickerContainer: {
    borderRadius: 16,
    marginTop: 16,
    overflow: 'hidden',
    borderWidth: 1,
  },
  iosPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  iosPickerDone: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  button: {
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#002E15',
  },
});
