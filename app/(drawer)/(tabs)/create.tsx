import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  TextInput, 
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Modal,
  ActivityIndicator,
  Alert
} from 'react-native';
import { 
  Video as VideoIcon, 
  Film, 
  Image as ImageIcon, 
  Upload, 
  ChevronDown,
  Check,
  X
} from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import AppHeader from '@/components/AppHeader';
import * as ImagePicker from 'expo-image-picker';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Image } from 'expo-image';

import VideoCropper from '@/components/VideoCropper';
import VideoTrimmer from '@/components/VideoTrimmer';

import { TwitchGame } from '@/context/UserContext';
import GameSelectorModal from '@/components/GameSelectorModal';
import { trpc } from '@/lib/trpc';
import { useDebounce } from '@/hooks/useDebounce';
import { gamefolioUpload, UploadLimitError, getGamefolioToken } from '@/lib/gamefolio-api';
import { useAuth } from '@/context/AuthContext';

export default function CreateScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { type } = params;
  const { isAuthenticated } = useAuth();
  
  const [isUploading, setIsUploading] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'clips' | 'reels' | 'screenshots'>('clips');
  const [selectedFile, setSelectedFile] = useState<ImagePicker.ImagePickerAsset | null>(null);
  
  // Cropper State
  const [cropVisible, setCropVisible] = useState(false);
  const [tempVideo, setTempVideo] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [cropData, setCropData] = useState<{ scale: number; x: number; y: number; frameWidth: number } | null>(null);
  const [previewWidth, setPreviewWidth] = useState(0);

  // Trimmer State
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [trimRange, setTrimRange] = useState({ start: 0, end: 0 });
  const [isTrimming, setIsTrimming] = useState(false);
  const prevTrimRange = useRef({ start: 0, end: 0 });

  const player = useVideoPlayer(selectedFile?.uri ?? '', player => {
    player.loop = true;
    if (selectedFile?.uri) {
        player.play();
    }
  });

  useEffect(() => {
     if (!player) return;
     const subscription = player.addListener('timeUpdate', (event) => {
          setCurrentTime(event.currentTime);
     });
     return () => subscription.remove();
  }, [player]);

  // Player effect for trim range seeking
  useEffect(() => {
     if (!selectedFile || !player) return;
     
     const { start, end } = trimRange;
     const { start: prevStart, end: prevEnd } = prevTrimRange.current;
     
     // Only seek if we are actively trimming to give feedback
     if (isTrimming) {
        if (Math.abs(start - prevStart) > 0.05) {
            player.currentTime = start;
        } else if (Math.abs(end - prevEnd) > 0.05) {
            player.currentTime = end;
        }
     }
     
     prevTrimRange.current = trimRange;
  }, [trimRange, player, selectedFile, isTrimming]);

  // Duration sync effect
  useEffect(() => {
    if (!player || !selectedFile) return;

    // Check duration periodically to ensure we have the correct duration from the player
    // This is important because asset.duration might be missing or incorrect
    const interval = setInterval(() => {
        if (player.duration > 0 && Math.abs(player.duration - videoDuration) > 0.1) {
             // console.log('Updating duration from player:', player.duration);
             setVideoDuration(player.duration);
        }
    }, 500);
    
    return () => clearInterval(interval);
  }, [player, selectedFile, videoDuration]);

  // Loop logic
  useEffect(() => {
    if (!player || !selectedFile || isTrimming) return;
    
    const interval = setInterval(() => {
        if (trimRange.end > 0) {
            const current = player.currentTime;
            // Check if we are outside the range with a small buffer
            if (current >= trimRange.end - 0.1) {
                 player.currentTime = trimRange.start;
                 if (!player.playing) player.play();
            } else if (current < trimRange.start - 0.5) {
                 // If we somehow got before start
                 player.currentTime = trimRange.start;
            }
        }
    }, 50);
    
    return () => clearInterval(interval);
  }, [player, selectedFile, trimRange, isTrimming]);

  useEffect(() => {
    if (trimRange.end > 0) {
        // console.log('Trim range updated:', trimRange);
    }
  }, [trimRange]);

  useEffect(() => {
    if (selectedFile?.uri) {
        player.replace(selectedFile.uri);
        player.play();
    }
  }, [selectedFile?.uri, player]);

  // Clear selected file when tab changes
  useEffect(() => {
    setSelectedFile(null);
    setCropData(null);
    setTempVideo(null);
    setVideoDuration(0);
    setTrimRange({ start: 0, end: 0 });
  }, [activeTab]);

  React.useEffect(() => {
    if (type && ['clips', 'reels', 'screenshots'].includes(type as string)) {
      setActiveTab(type as 'clips' | 'reels' | 'screenshots');
    }
  }, [type]);
  const [isAgeRestricted, setIsAgeRestricted] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [gameModalVisible, setGameModalVisible] = useState(false);
  const [selectedGame, setSelectedGame] = useState<TwitchGame | null>(null);
  
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const descriptionInputRef = useRef<TextInput>(null);
  
  const debouncedMentionQuery = useDebounce(mentionQuery, 300);
  
  const { data: mentionSuggestions } = trpc.users.search.useQuery(
    { query: debouncedMentionQuery },
    { enabled: showMentionDropdown && debouncedMentionQuery.length > 0 }
  );
  
  const { data: trendingTags } = trpc.tags.getTrending.useQuery();

  const handleUpload = async () => {
    if (!selectedFile) {
      Alert.alert('Error', `Please select a ${activeTab === 'screenshots' ? 'screenshot' : 'video'} to upload`);
      return;
    }
    
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }
    
    if (!selectedGame) {
      Alert.alert('Error', 'Please select a game');
      return;
    }
    
    setIsUploading(true);
    
    try {
      console.log('[Upload] Starting upload...');
      console.log('[Upload] Type:', activeTab);
      console.log('[Upload] Title:', title);
      console.log('[Upload] Description:', description);
      console.log('[Upload] Game:', selectedGame.name);
      console.log('[Upload] Tags:', tags);
      console.log('[Upload] Age Restricted:', isAgeRestricted);
      console.log('[Upload] File URI:', selectedFile.uri);
      console.log('[Upload] Video duration:', videoDuration);
      console.log('[Upload] Trim range:', trimRange);
      
      console.log('[Upload] Getting Gamefolio access token...');
      
      if (!isAuthenticated) {
        console.error('[Upload] User is not authenticated');
        Alert.alert(
          'Authentication Required', 
          'You must be logged in to upload content. Please log in and try again.'
        );
        setIsUploading(false);
        return;
      }
      
      const accessToken = await getGamefolioToken();
      
      if (!accessToken) {
        console.error('[Upload] No Gamefolio access token available');
        Alert.alert(
          'Session Expired', 
          'Your session has expired. Please log out and log back in to upload content.'
        );
        setIsUploading(false);
        return;
      }
      
      console.log('[Upload] Gamefolio access token obtained successfully');
      console.log('[Upload] Token length:', accessToken.length);
      console.log('[Upload] Token preview:', accessToken.substring(0, 30) + '...');

      const uploadData: {
        title: string;
        description: string;
        gameId: string;
        tags: string[];
        ageRestricted: boolean;
        trimStart?: number;
        trimEnd?: number;
      } = {
        title: title.trim(),
        description: description.trim(),
        gameId: selectedGame.id,
        tags: tags,
        ageRestricted: isAgeRestricted,
      };
      
      // Add trim parameters for video uploads
      if (activeTab !== 'screenshots' && trimRange.start > 0) {
        uploadData.trimStart = trimRange.start;
        console.log('[Upload] Adding trim start:', trimRange.start);
      }
      if (activeTab !== 'screenshots' && trimRange.end > 0 && trimRange.end < videoDuration) {
        uploadData.trimEnd = trimRange.end;
        console.log('[Upload] Adding trim end:', trimRange.end);
      }

      let result;
      if (activeTab === 'screenshots') {
        console.log('[Upload] Uploading screenshot...');
        result = await gamefolioUpload.uploadScreenshot(
          selectedFile.uri,
          uploadData,
          accessToken
        );
      } else {
        console.log('[Upload] Uploading', activeTab === 'clips' ? 'clip' : 'reel', '...');
        console.log('[Upload] Asset mimeType:', selectedFile.mimeType);
        result = await gamefolioUpload.uploadClipOrReel(
          selectedFile.uri,
          activeTab === 'clips' ? 'clip' : 'reel',
          uploadData,
          accessToken,
          selectedFile.mimeType || undefined
        );
      }
      
      console.log('[Upload] Upload successful!', result);
      
      Alert.alert(
        'Upload Successful!',
        `Your ${activeTab === 'clips' ? 'clip' : activeTab === 'reels' ? 'reel' : 'screenshot'} has been uploaded successfully!\n\nTitle: ${title}\nGame: ${selectedGame.name}`,
        [
          {
            text: 'OK',
            onPress: () => {
              setTitle('');
              setDescription('');
              setTags([]);
              setSelectedFile(null);
              setSelectedGame(null);
              setIsAgeRestricted(false);
              setCropData(null);
              setVideoDuration(0);
              setTrimRange({ start: 0, end: 0 });
            }
          }
        ]
      );
      
    } catch (error: any) {
      console.error('[Upload] Upload error:', error);
      console.error('[Upload] Error details:', JSON.stringify(error, null, 2));
      
      if (error instanceof UploadLimitError) {
        Alert.alert(
          'Upload Limit Reached',
          error.limits?.message || error.message || 'You have reached your upload limit. Please try again later.'
        );
      } else if (error.message?.includes('401')) {
        Alert.alert(
          'Authentication Error',
          'Your session may have expired. Please try logging out and back in.'
        );
      } else {
        Alert.alert('Upload Failed', error.message || 'Failed to upload. Please try again.');
      }
    } finally {
      setIsUploading(false);
    }
  };

  const addTag = (tag: string) => {
    if (!tags.includes(tag)) {
        setTags([...tags, tag]);
    }
    setTagInput('');
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleTagSubmit = () => {
    const trimmedInput = tagInput.trim();
    if (trimmedInput.length > 0) {
        // Allow adding multiple tags separated by comma if user pasted text
        if (trimmedInput.includes(',')) {
            const newTags = trimmedInput.split(',').map(t => t.trim()).filter(Boolean);
            const uniqueNewTags = newTags.filter(t => !tags.includes(t));
            if (uniqueNewTags.length > 0) {
                setTags([...tags, ...uniqueNewTags]);
            }
        } else {
            if (!tags.includes(trimmedInput)) {
                setTags([...tags, trimmedInput]);
            }
        }
        setTagInput('');
    }
  };

  const handleDescriptionChange = (text: string) => {
    setDescription(text);
    
    const lastAtIndex = text.lastIndexOf('@', cursorPosition);
    const textBeforeCursor = text.substring(0, cursorPosition);
    const lastSpaceIndex = textBeforeCursor.lastIndexOf(' ');
    const lastNewlineIndex = textBeforeCursor.lastIndexOf('\n');
    const lastBreakIndex = Math.max(lastSpaceIndex, lastNewlineIndex);
    
    if (lastAtIndex > lastBreakIndex && lastAtIndex < cursorPosition) {
      const query = text.substring(lastAtIndex + 1, cursorPosition);
      if (query.length >= 0 && !query.includes(' ') && !query.includes('\n')) {
        setMentionQuery(query);
        setMentionStartIndex(lastAtIndex);
        setShowMentionDropdown(true);
      } else {
        setShowMentionDropdown(false);
      }
    } else {
      setShowMentionDropdown(false);
    }
  };

  const handleMentionSelect = (username: string) => {
    if (mentionStartIndex >= 0) {
      const before = description.substring(0, mentionStartIndex);
      const after = description.substring(cursorPosition);
      const newText = `${before}@${username} ${after}`;
      setDescription(newText);
      const newCursorPos = mentionStartIndex + username.length + 2;
      setCursorPosition(newCursorPos);
      
      setTimeout(() => {
        descriptionInputRef.current?.setNativeProps({
          selection: { start: newCursorPos, end: newCursorPos }
        });
      }, 0);
    }
    setShowMentionDropdown(false);
    setMentionQuery('');
    setMentionStartIndex(-1);
  };

  const renderDescriptionWithMentions = () => {
    const parts: { text: string; isMention: boolean }[] = [];
    const mentionRegex = /@(\w+)/g;
    let lastIndex = 0;
    let match;
    
    while ((match = mentionRegex.exec(description)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ text: description.substring(lastIndex, match.index), isMention: false });
      }
      parts.push({ text: match[0], isMention: true });
      lastIndex = match.index + match[0].length;
    }
    
    if (lastIndex < description.length) {
      parts.push({ text: description.substring(lastIndex), isMention: false });
    }
    
    return parts.map((part, index) => (
      <Text key={index} style={part.isMention ? styles.mentionText : styles.normalText}>
        {part.text}
      </Text>
    ));
  };

  const pickMedia = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: activeTab === 'screenshots' 
          ? ImagePicker.MediaTypeOptions.Images 
          : ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: activeTab !== 'reels', // Disable default editing for reels as we have custom cropper
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        
        if (asset.duration) {
             setVideoDuration(asset.duration / 1000);
        }

        // Check for reels aspect ratio
        if (activeTab === 'reels' && asset.type === 'video') {
             const { width, height } = asset;
             const ratio = width / height;
             const targetRatio = 9/16; // 0.5625
             
             // If ratio is significantly different (e.g. > 0.05 difference), show cropper
             // Or if user just wants to zoom, maybe always show cropper?
             // Prompt says: "When a user uploads a video that isn't 9:16, show the zoom screen"
             if (Math.abs(ratio - targetRatio) > 0.05) {
                 setTempVideo(asset);
                 setCropVisible(true);
                 return;
             }
        }
        
        setSelectedFile(asset);
      }
    } catch (error) {
      console.log('Error picking media:', error);
    }
  };

  const handleCropComplete = (data: { scale: number; x: number; y: number; frameWidth: number }) => {
    setCropData(data);
    if (tempVideo) {
        setSelectedFile(tempVideo);
    }
    setCropVisible(false);
    setTempVideo(null);
  };

  const handleCropCancel = () => {
    setCropVisible(false);
    setTempVideo(null);
  };

  const removeFile = () => {
    setSelectedFile(null);
    setCropData(null);
    setVideoDuration(0);
    setTrimRange({ start: 0, end: 0 });
    setIsTrimming(false);
    prevTrimRange.current = { start: 0, end: 0 };
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0F1520', '#020617']}
        style={StyleSheet.absoluteFill}
      />

      <AppHeader />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {type ? `Upload ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1, -1)}` : 'Upload Content'}
        </Text>
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView 
          style={styles.content}
          contentContainerStyle={{ paddingBottom: 150 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
        {!type && (
          <View style={styles.tabsContainer}>
            <TouchableOpacity 
              style={[styles.tabButton, activeTab === 'clips' && styles.activeTabButton]}
              onPress={() => setActiveTab('clips')}
            >
              <VideoIcon size={16} color={activeTab === 'clips' ? '#000' : '#94A3B8'} />
              <Text style={[styles.tabText, activeTab === 'clips' && styles.activeTabText]}>Clips</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.tabButton, activeTab === 'reels' && styles.activeTabButton]}
              onPress={() => setActiveTab('reels')}
            >
              <Film size={16} color={activeTab === 'reels' ? '#000' : '#94A3B8'} />
              <Text style={[styles.tabText, activeTab === 'reels' && styles.activeTabText]}>Reels</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.tabButton, activeTab === 'screenshots' && styles.activeTabButton]}
              onPress={() => setActiveTab('screenshots')}
            >
              <ImageIcon size={16} color={activeTab === 'screenshots' ? '#000' : '#94A3B8'} />
              <Text style={[styles.tabText, activeTab === 'screenshots' && styles.activeTabText]}>Screenshots</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.section}>
          {activeTab === 'screenshots' && (
            <Text style={styles.sectionTitle}>
              Share your screenshot
            </Text>
          )}
          <Text style={styles.sectionSubtitle}>
            {activeTab === 'clips' && 'Upload a video clip to share with the Gamefolio community'}
            {activeTab === 'reels' && 'Upload a 9:16 video to your Gamefolio'}
            {activeTab === 'screenshots' && 'Upload a screenshot to share with the Gamefolio community'}
          </Text>
          
          <TouchableOpacity 
            style={[
            styles.uploadAreaBase,
            activeTab === 'reels' ? styles.uploadAreaReels : styles.uploadAreaDefault,
            selectedFile ? styles.uploadAreaFilled : {}
          ]}
            onPress={pickMedia}
            disabled={!!selectedFile}
            onLayout={(e) => setPreviewWidth(e.nativeEvent.layout.width)}
          >
            {selectedFile ? (
                <View style={[
                    StyleSheet.absoluteFill, 
                    { overflow: 'hidden', borderRadius: activeTab === 'reels' ? 30 : 12 }
                ]}>
                    {activeTab === 'screenshots' ? (
                        <Image 
                            source={{ uri: selectedFile.uri }} 
                            style={styles.previewImage} 
                            contentFit="contain"
                        />
                    ) : (
                         <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                             {/* If we have crop data, apply transforms. Otherwise normal fit */}
                             <View style={
                                 cropData ? {
                                     width: selectedFile.width,
                                     height: selectedFile.height,
                                     transform: [
                                         { scale: cropData.scale * (previewWidth / cropData.frameWidth) },
                                         { translateX: cropData.x * (previewWidth / cropData.frameWidth) },
                                         { translateY: cropData.y * (previewWidth / cropData.frameWidth) }
                                     ]
                                 } : { width: '100%', height: '100%' }
                             }>
                                <VideoView 
                                    player={player} 
                                    style={{ width: '100%', height: '100%' }} 
                                    contentFit={cropData ? "contain" : "contain"} // If cropped, we are handling fit manually via transform
                                    nativeControls={false}
                                />
                             </View>
                         </View>
                    )}
                    <TouchableOpacity style={styles.removeButton} onPress={removeFile}>
                        <X size={20} color="#FFF" />
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={styles.uploadContent}>
                <Upload size={32} color="#94A3B8" />
                <Text style={styles.uploadText}>
                    {activeTab === 'screenshots' ? 'Drag and drop your image or click to browse' : 'Drag and drop your video or click to browse'}
                </Text>
                <Text style={styles.uploadSubtext}>
                    {activeTab === 'screenshots' ? 'PNG, JPG, or JPEG up to 10MB' : 'MP4, WebM, or MOV up to 500MB'}
                </Text>
                {activeTab === 'reels' && (
                    <Text style={styles.aspectRatioText}>Recommended: 9:16 aspect ratio</Text>
                )}
                </View>
            )}
          </TouchableOpacity>
          
          {selectedFile && activeTab !== 'screenshots' && (
            <VideoTrimmer 
                key={selectedFile.uri}
                duration={videoDuration}
                videoUri={selectedFile.uri}
                currentTime={currentTime}
                onScrub={(time) => {
                    if (player) {
                        player.currentTime = time;
                    }
                }}
                onTrimChange={(start, end) => setTrimRange({ start, end })}
                onInteractionStart={() => {
                    setIsTrimming(true);
                    player.pause();
                }}
                onInteractionEnd={() => {
                    setIsTrimming(false);
                    // Ensure we are within bounds when releasing
                    const current = player.currentTime;
                    if (trimRange.end > 0 && (current < trimRange.start || current > trimRange.end)) {
                        player.currentTime = trimRange.start;
                    }
                    player.play();
                }}
                style={{ marginTop: 16, marginBottom: 8 }}
            />
          )}

          <Text style={styles.videoFileText}>
            {activeTab === 'screenshots' ? 'Image File' : 'Video File'} <Text style={styles.subText}>
              {activeTab === 'screenshots' ? '(Maximum 10MB)' : '(Maximum 500MB)'}
            </Text>
          </Text>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Title <Text style={styles.required}>*</Text></Text>
          <TextInput 
            style={styles.input}
            placeholder={
                activeTab === 'clips' ? "Give your clip a catchy title" :
                activeTab === 'reels' ? "Give your reel a catchy title" :
                "Give your screenshot a catchy title"
            }
            placeholderTextColor="#64748B"
            value={title}
            onChangeText={setTitle}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Description (use @username to mention users)</Text>
          <View>
            <TextInput 
              ref={descriptionInputRef}
              style={[styles.input, styles.textArea]}
              placeholder={
                  activeTab === 'clips' ? "Describe what's happening in your clip. Use @username to mention other users!" :
                  activeTab === 'reels' ? "Describe what's happening in your reel. Use @username to mention other users!" :
                  "Describe your screenshot. Use @username to mention other users!"
              }
              placeholderTextColor="#64748B"
              multiline
              textAlignVertical="top"
              value={description}
              onChangeText={handleDescriptionChange}
              onSelectionChange={(event) => setCursorPosition(event.nativeEvent.selection.start)}
            />
            {description.length > 0 && (
              <View style={styles.descriptionPreview}>
                <Text style={styles.descriptionPreviewLabel}>Preview:</Text>
                <View style={styles.descriptionPreviewText}>
                  {renderDescriptionWithMentions()}
                </View>
              </View>
            )}
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Game <Text style={styles.required}>*</Text></Text>
          <TouchableOpacity 
            style={styles.selectInput}
            onPress={() => setGameModalVisible(true)}
          >
            {selectedGame ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Image 
                  source={{ uri: selectedGame.box_art_url.replace('{width}', '40').replace('{height}', '53') }} 
                  style={{ width: 20, height: 27, borderRadius: 4 }}
                />
                <Text style={{ color: '#FFF', fontSize: 14 }}>{selectedGame.name}</Text>
              </View>
            ) : (
              <Text style={styles.selectPlaceholder}>Select a game...</Text>
            )}
            <ChevronDown size={20} color="#64748B" />
          </TouchableOpacity>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Tags #</Text>
          <View style={styles.tagInputContainer}>
            {tags.map((tag, index) => (
                <View key={index} style={styles.tagPill}>
                    <Text style={styles.tagPillText}>{tag}</Text>
                    <TouchableOpacity onPress={() => removeTag(tag)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <X size={14} color="#94A3B8" />
                    </TouchableOpacity>
                </View>
            ))}
            <TextInput 
                style={styles.tagInput}
                placeholder={tags.length === 0 ? "Add tags..." : ""}
                placeholderTextColor="#64748B"
                value={tagInput}
                onChangeText={setTagInput}
                onSubmitEditing={handleTagSubmit}
                blurOnSubmit={false}
                returnKeyType="done"
            />
          </View>
          {trendingTags && trendingTags.length > 0 && (
            <View style={styles.suggestionsContainer}>
                <Text style={styles.suggestionsTitle}>Trending:</Text>
                <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false} 
                    contentContainerStyle={styles.suggestionsList}
                    keyboardShouldPersistTaps="handled"
                >
                    {trendingTags.map((tag) => (
                        <TouchableOpacity 
                            key={tag} 
                            style={styles.suggestionChip}
                            onPress={() => addTag(tag)}
                        >
                            <Text style={styles.suggestionText}>#{tag}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>
          )}
        </View>

        <TouchableOpacity 
          style={styles.checkboxContainer}
          onPress={() => setIsAgeRestricted(!isAgeRestricted)}
        >
          <View style={[styles.checkbox, isAgeRestricted && styles.checkboxChecked]}>
            {isAgeRestricted && <Check size={14} color="#000" />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.checkboxLabel}>Age Restricted</Text>
            <Text style={styles.checkboxSublabel}>
                Mark for mature audiences (18+)
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.footer}>
            {/* Using a transparent view to push buttons to right if we wanted, but flex-end works */}
            <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => router.back()}
            >
                <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity 
                style={[styles.uploadButton, isUploading && styles.uploadButtonDisabled]}
                onPress={handleUpload}
                disabled={isUploading}
            >
                {isUploading ? (
                  <ActivityIndicator size="small" color="#002E15" style={{ marginRight: 8 }} />
                ) : (
                  <Upload size={16} color="#002E15" style={{ marginRight: 8 }} />
                )}
                <Text style={styles.uploadButtonText}>
                  {isUploading ? 'Uploading...' : 'Upload'}
                </Text>
            </TouchableOpacity>
        </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {tempVideo && (
        <VideoCropper
            visible={cropVisible}
            videoUri={tempVideo.uri}
            videoWidth={tempVideo.width}
            videoHeight={tempVideo.height}
            onCancel={handleCropCancel}
            onComplete={handleCropComplete}
        />
      )}
      
      <GameSelectorModal 
        visible={gameModalVisible}
        onClose={() => setGameModalVisible(false)}
        onSelect={setSelectedGame}
      />
      
      <Modal
        visible={showMentionDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMentionDropdown(false)}
      >
        <TouchableOpacity 
          style={styles.mentionOverlay}
          activeOpacity={1}
          onPress={() => setShowMentionDropdown(false)}
        >
          <View style={styles.mentionDropdown}>
            {mentionSuggestions && mentionSuggestions.length > 0 ? (
              <FlatList
                data={mentionSuggestions}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.mentionItem}
                    onPress={() => handleMentionSelect(item.username)}
                  >
                    <Image 
                      source={{ uri: item.avatarUrl }} 
                      style={styles.mentionAvatar}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.mentionUsername}>@{item.username}</Text>
                      {item.displayName !== item.username && (
                        <Text style={styles.mentionDisplayName}>{item.displayName}</Text>
                      )}
                    </View>
                    {item.isOnline && <View style={styles.onlineIndicator} />}
                  </TouchableOpacity>
                )}
                keyboardShouldPersistTaps="handled"
              />
            ) : (
              <View style={styles.mentionEmpty}>
                <Text style={styles.mentionEmptyText}>
                  {mentionQuery.length === 0 ? 'Type to search users...' : 'No users found'}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// Helper component DurationChecker removed as logic is now integrated into main component

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1520',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  tabsContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 12,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    gap: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  activeTabButton: {
    backgroundColor: '#4ADE80',
    borderColor: '#4ADE80',
  },
  tabText: {
    color: '#94A3B8',
    fontWeight: '600',
    fontSize: 14,
  },
  activeTabText: {
    color: '#002E15',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 16,
  },
  videoFileText: {
    fontSize: 12,
    color: '#FFF',
    fontWeight: '500',
    marginBottom: 4,
  },
  subText: {
    color: '#64748B',
    fontWeight: '400',
  },
  uploadAreaBase: {
    borderWidth: 1,
    borderColor: '#334155',
    borderStyle: 'dashed',
    borderRadius: 12,
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  uploadAreaDefault: {
    height: 160,
  },
  uploadAreaReels: {
    width: '75%', // Taller 9:16 aspect ratio
    aspectRatio: 9 / 16,
    alignSelf: 'center',
    borderWidth: 2,
    borderRadius: 30,
    marginTop: 20,
    marginBottom: 20,
  },
  aspectRatioText: {
    color: '#4ADE80',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  uploadContent: {
    alignItems: 'center',
    gap: 8,
  },
  uploadText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  uploadAreaFilled: {
    borderStyle: 'solid',
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewVideo: {
    width: '100%',
    height: '100%',
  },
  removeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 6,
    zIndex: 10,
  },
  uploadSubtext: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 8,
  },
  required: {
    color: '#EF4444',
  },
  input: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    padding: 12,
    color: '#FFF',
    fontSize: 14,
  },
  textArea: {
    height: 100,
  },
  selectInput: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectPlaceholder: {
    color: '#64748B',
    fontSize: 14,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    padding: 16,
    borderRadius: 8,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#334155',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#4ADE80',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#4ADE80',
  },
  checkboxLabel: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
    marginBottom: 2,
  },
  checkboxSublabel: {
    color: '#94A3B8',
    fontSize: 12,
    flexShrink: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cancelButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4ADE80',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  uploadButtonDisabled: {
    opacity: 0.5,
  },
  uploadButtonText: {
    color: '#002E15',
    fontWeight: 'bold',
    fontSize: 14,
  },
  suggestionsContainer: {
    marginTop: 12,
  },
  suggestionsTitle: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  suggestionsList: {
    paddingRight: 20,
    gap: 8,
  },
  suggestionChip: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  suggestionText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '500',
  },
  tagInputContainer: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    padding: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: '#4ADE80',
  },
  tagPillText: {
    color: '#FFF',
    fontSize: 14,
  },
  tagInput: {
    flex: 1,
    minWidth: 100,
    color: '#FFF',
    fontSize: 14,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  descriptionPreview: {
    marginTop: 8,
    padding: 12,
    backgroundColor: 'rgba(15, 21, 32, 0.8)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  descriptionPreviewLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  descriptionPreviewText: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  normalText: {
    color: '#E2E8F0',
    fontSize: 14,
    lineHeight: 20,
  },
  mentionText: {
    color: '#4ADE80',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  mentionOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  mentionDropdown: {
    width: '100%',
    maxWidth: 400,
    maxHeight: 300,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4ADE80',
    overflow: 'hidden',
  },
  mentionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    gap: 12,
  },
  mentionAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#334155',
  },
  mentionUsername: {
    color: '#4ADE80',
    fontSize: 14,
    fontWeight: '600',
  },
  mentionDisplayName: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  onlineIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4ADE80',
  },
  mentionEmpty: {
    padding: 20,
    alignItems: 'center',
  },
  mentionEmptyText: {
    color: '#64748B',
    fontSize: 14,
  },
});
