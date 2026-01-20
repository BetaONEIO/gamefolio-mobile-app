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
import { ChevronLeft, Cake } from 'lucide-react-native';

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
  // Helper state for web input to prevent invalid date crashes
  const [textValue, setTextValue] = useState(() => {
    try {
      return (initialDate || new Date()).toISOString().split('T')[0];
    } catch (_) {
      return new Date().toISOString().split('T')[0];
    }
  });

  // Sync state when modal opens or initialDate changes
  useEffect(() => {
    if (visible) {
      const d = initialDate || new Date();
      setDate(d);
      try {
        setTextValue(d.toISOString().split('T')[0]);
      } catch (_) {
        // Fallback if date is invalid
        setTextValue(new Date().toISOString().split('T')[0]);
      }
    }
  }, [visible, initialDate]);

  // App Theme Colors (matching app/index.tsx)
  const colors = {
    background: '#0F1520',
    primary: '#4ADE80',
    secondary: '#1E293B',
    text: '#FFFFFF',
    textDim: '#94A3B8',
    inputBg: '#1E293B', // Solid color for better visibility
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (selectedDate) {
      setDate(selectedDate);
      try {
        setTextValue(selectedDate.toISOString().split('T')[0]);
      } catch (_) {
        // ignore
      }
    }
  };

  const handleWebDateChange = (text: string) => {
    setTextValue(text);
    // Basic validation for YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      const newDate = new Date(text);
      // Only update date object if it's a valid date
      if (!isNaN(newDate.getTime())) {
        setDate(newDate);
      }
    }
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
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.backButton}>
              <ChevronLeft size={28} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {/* Title Section */}
            <View style={styles.titleContainer}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: colors.text }]}>
                  When&apos;s your{'\n'}birthday?
                </Text>
                <Text style={[styles.subtitle, { color: colors.textDim }]}>
                  Your birthday won&apos;t be shown publicly.
                </Text>
              </View>
              <Cake size={48} color={colors.primary} style={styles.icon} />
            </View>

            {/* Display Field */}
            <View style={[styles.displayField, { backgroundColor: colors.inputBg }]}>
              <Text style={[styles.dateText, { color: colors.text }]}>
                {date.toLocaleDateString('en-US', { 
                  month: 'long', 
                  day: 'numeric', 
                  year: 'numeric' 
                })}
              </Text>
            </View>

            {/* Spacer to push picker to bottom */}
            <View style={{ flex: 1 }} />

            {/* Date Picker */}
            <View style={styles.pickerContainer}>
              {Platform.OS === 'web' ? (
                 <View style={{ width: '100%', alignItems: 'center' }}>
                   <TextInput
                     value={textValue}
                     onChangeText={handleWebDateChange}
                     style={{
                       padding: 12,
                       fontSize: 16,
                       borderRadius: 12,
                       borderWidth: 1,
                       borderColor: 'rgba(255,255,255,0.1)',
                       backgroundColor: 'rgba(30, 41, 59, 0.5)',
                       color: 'white',
                       width: '100%',
                       maxWidth: 320,
                       height: 56,
                       textAlign: 'center',
                       outlineStyle: 'none' // Remove web outline
                     }}
                     // @ts-ignore - web only prop
                     type="date"
                     max={new Date().toISOString().split('T')[0]}
                   />
                 </View>
              ) : (
                <DateTimePicker
                  value={date}
                  mode="date"
                  display="spinner"
                  onChange={handleDateChange}
                  textColor={colors.text}
                  themeVariant="dark" // iOS only
                  maximumDate={new Date()}
                  style={styles.picker}
                />
              )}
            </View>

            {/* Continue Button */}
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
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 20,
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 38,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
  },
  icon: {
    marginTop: 8,
    marginLeft: 16,
  },
  displayField: {
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    paddingHorizontal: 16,
    // Removed border to match screenshot style cleaner look
  },
  dateText: {
    fontSize: 18,
    fontWeight: '500',
  },
  pickerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  picker: {
    width: '100%',
    height: 200, // Standard height for spinner
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
    fontWeight: '700',
    color: '#002E15',
  },
});
