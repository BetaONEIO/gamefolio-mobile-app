
import { db } from './db';
import { profileBanners } from '../shared/schema';
import fs from 'fs';
import path from 'path';

async function updateBanners() {
  console.log('🔄 Clearing existing banners...');
  
  // Clear existing banners
  await db.delete(profileBanners);
  
  console.log('✅ Existing banners cleared');
  
  // Define new gradient banner data
  const newBanners = [
    {
      name: 'Dark Gradient',
      imageUrl: '/banners/gradient-dark.png',
      category: 'gradient'
    },
    {
      name: 'Light Gradient', 
      imageUrl: '/banners/gradient-light.png',
      category: 'gradient'
    },
    {
      name: 'Teal Gradient',
      imageUrl: '/banners/gradient-teal.png', 
      category: 'gradient'
    },
    {
      name: 'Blue Gradient',
      imageUrl: '/banners/gradient-blue.png',
      category: 'gradient'
    },
    {
      name: 'Red Green Gradient',
      imageUrl: '/banners/gradient-red-green.png',
      category: 'gradient'
    },
    {
      name: 'Navy Gold Gradient',
      imageUrl: '/banners/gradient-navy-gold.png',
      category: 'gradient'
    },
    {
      name: 'Purple Pink Gradient',
      imageUrl: '/banners/gradient-purple-pink.png',
      category: 'gradient'
    },
    {
      name: 'Green Black Gradient',
      imageUrl: '/banners/gradient-green-black.png',
      category: 'gradient'
    },
    {
      name: 'Gold Gradient',
      imageUrl: '/banners/gradient-gold.png',
      category: 'gradient'
    }
  ];
  
  console.log('🎨 Inserting new gradient banners...');
  
  // Insert new banners
  const result = await db.insert(profileBanners).values(newBanners).returning();
  
  console.log(`✅ Successfully inserted ${result.length} new gradient banners`);
  console.log('Banner IDs:', result.map(b => `${b.id}: ${b.name}`));
}

// Run the update
updateBanners()
  .then(() => {
    console.log('🎉 Banner update completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error updating banners:', error);
    process.exit(1);
  });
