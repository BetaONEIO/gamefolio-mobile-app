import sharp from 'sharp';

/**
 * Creates a play button overlay on a thumbnail image
 * @param thumbnailUrl - URL of the original thumbnail
 * @returns Buffer of the thumbnail with play button overlay
 */
export async function addPlayButtonOverlay(thumbnailUrl: string): Promise<Buffer> {
  try {
    // Fetch the original thumbnail
    const response = await fetch(thumbnailUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch thumbnail: ${response.statusText}`);
    }
    
    const thumbnailBuffer = Buffer.from(await response.arrayBuffer());
    
    // Get image dimensions
    const metadata = await sharp(thumbnailBuffer, { failOn: 'none' }).metadata();
    const width = metadata.width || 1200;
    const height = metadata.height || 630;
    
    // Calculate play button size (about 20% of image width)
    const buttonSize = Math.floor(width * 0.2);
    const buttonRadius = buttonSize / 2;
    
    // Create play button SVG
    const playButtonSvg = `
      <svg width="${buttonSize}" height="${buttonSize}" xmlns="http://www.w3.org/2000/svg">
        <!-- Semi-transparent dark circle background -->
        <circle cx="${buttonRadius}" cy="${buttonRadius}" r="${buttonRadius}" 
          fill="rgba(0, 0, 0, 0.7)" />
        
        <!-- White circle border -->
        <circle cx="${buttonRadius}" cy="${buttonRadius}" r="${buttonRadius - 4}" 
          fill="none" stroke="rgba(255, 255, 255, 0.9)" stroke-width="3" />
        
        <!-- Play triangle -->
        <path d="M ${buttonRadius * 0.7} ${buttonRadius * 0.5} 
                 L ${buttonRadius * 1.5} ${buttonRadius} 
                 L ${buttonRadius * 0.7} ${buttonRadius * 1.5} Z" 
          fill="rgba(255, 255, 255, 0.95)" />
      </svg>
    `;
    
    // Composite the play button in the center
    const result = await sharp(thumbnailBuffer, { failOn: 'none' })
      .resize(1200, 630, { fit: 'cover', position: 'center' })
      .composite([{
        input: Buffer.from(playButtonSvg),
        left: Math.floor((1200 - buttonSize) / 2),
        top: Math.floor((630 - buttonSize) / 2),
        blend: 'over'
      }])
      .jpeg({ quality: 90 })
      .toBuffer();
    
    return result;
  } catch (error) {
    console.error('Error adding play button overlay:', error);
    throw error;
  }
}
