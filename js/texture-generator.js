// Utility for generating procedural textures
class TextureGenerator {
  constructor(gl) {
    this.gl = gl;
    this.textureSize = 64; // Increased from 32 to 64 for better texture quality
    this.cachedTextures = {}; // Cache textures to avoid regeneration
    this.textureGenerationComplete = false;
  }
  
  // Create a WebGL texture from raw pixel data with optimized settings
  createTextureFromData(data, width, height) {
    const gl = this.gl;
    
    // Create and bind the texture
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    
    // Set alignment to 1 to support any texture size
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    
    // Upload the image data to the texture
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    
    // Generate mipmaps for better quality at distance
    gl.generateMipmap(gl.TEXTURE_2D);
    
    // For grass textures specifically, use NEAREST_MIPMAP_LINEAR instead of LINEAR_MIPMAP_LINEAR
    // This preserves the sharp edges in the texture while still having smooth transitions at distance
    if (width === this.textureSize && height === this.textureSize) {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    } else {
      // For other textures, use the default high-quality settings
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    }
    
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); // Changed back to REPEAT for seamless tiling
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT); // Changed back to REPEAT for seamless tiling
    
    // Apply anisotropic filtering if available
    if (gl.anisotropy) {
      gl.texParameterf(gl.TEXTURE_2D, gl.anisotropy.TEXTURE_MAX_ANISOTROPY_EXT, gl.anisotropyMax);
    }
    
    return texture;
  }
  
  // Create a WebGL texture specifically optimized for grass
  createSharpTextureFromData(data, width, height) {
    const gl = this.gl;
    
    // Create and bind the texture
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    
    // Set alignment to 1 to support any texture size
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    
    // Upload the image data to the texture
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    
    // Generate mipmaps for better quality at distance
    gl.generateMipmap(gl.TEXTURE_2D);
    
    // Use NEAREST filtering to preserve the sharp pixel edges in the texture
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    
    // Apply anisotropic filtering if available
    if (gl.anisotropy) {
      gl.texParameterf(gl.TEXTURE_2D, gl.anisotropy.TEXTURE_MAX_ANISOTROPY_EXT, gl.anisotropyMax);
    }
    
    return texture;
  }
  
  // Generate a super-simplified checkerboard pattern texture
  createCheckerTexture(size = this.textureSize, color1 = [200, 200, 200], color2 = [100, 100, 100]) {
    // Cache key for this texture
    const cacheKey = `checker_${size}_${color1.join('_')}_${color2.join('_')}`;
    if (this.cachedTextures[cacheKey]) {
      return this.cachedTextures[cacheKey];
    }
    
    const gl = this.gl;
    const data = new Uint8Array(size * size * 4);
    const blockSize = size / 2; // Even larger blocks for better performance
    
    // Pre-calculate colors for each block to avoid calculation in loop
    const colors = [color1, color2];
    
    // Fill the texture in one pass
    for (let blockY = 0; blockY < 2; blockY++) {
      for (let blockX = 0; blockX < 2; blockX++) {
        const isColor1 = (blockX + blockY) % 2 === 0;
        const color = isColor1 ? color1 : color2;
        
        // Fill this block
        for (let y = blockY * blockSize; y < (blockY + 1) * blockSize; y++) {
          for (let x = blockX * blockSize; x < (blockX + 1) * blockSize; x++) {
            const pixelIndex = (y * size + x) * 4;
        data[pixelIndex] = color[0];     // R
        data[pixelIndex + 1] = color[1]; // G
        data[pixelIndex + 2] = color[2]; // B
        data[pixelIndex + 3] = 255;      // A
      }
    }
      }
    }
    
    const texture = this.createTextureFromData(data, size, size);
    this.cachedTextures[cacheKey] = texture;
    return texture;
  }
  
  // Generate a super-simplified brick wall texture
  createBrickTexture(size = this.textureSize, brickColor = [180, 60, 60], mortarColor = [200, 200, 200]) {
    // Cache key for this texture
    const cacheKey = `brick_${size}_${brickColor.join('_')}_${mortarColor.join('_')}`;
    if (this.cachedTextures[cacheKey]) {
      return this.cachedTextures[cacheKey];
    }
    
    const gl = this.gl;
    const data = new Uint8Array(size * size * 4);
    
    // Simplify to just 2 rows of bricks
    const brickWidth = size / 2;
    const brickHeight = size / 2;
    const mortarSize = 2; // Fixed size mortar
    
    // Fill the texture with brick color first
    for (let i = 0; i < data.length; i += 4) {
      data[i] = brickColor[0];
      data[i + 1] = brickColor[1];
      data[i + 2] = brickColor[2];
      data[i + 3] = 255;
    }
    
    // Add mortar lines
    for (let y = 0; y < size; y++) {
      const isMortarY = y % brickHeight < mortarSize;
      
      for (let x = 0; x < size; x++) {
        // Calculate if this is in a horizontal mortar
        const row = Math.floor(y / brickHeight);
        const offset = (row % 2) * (brickWidth / 2);
        const adjustedX = (x + offset) % size;
        const isMortarX = adjustedX % brickWidth < mortarSize;
        
        if (isMortarX || isMortarY) {
        const pixelIndex = (y * size + x) * 4;
          data[pixelIndex] = mortarColor[0];
          data[pixelIndex + 1] = mortarColor[1];
          data[pixelIndex + 2] = mortarColor[2];
        }
      }
    }
    
    const texture = this.createTextureFromData(data, size, size);
    this.cachedTextures[cacheKey] = texture;
    return texture;
  }
  
  // Generate an ultra-simplified grass texture
  createGrassTexture(size = this.textureSize) {
    // Cache key for this texture
    const cacheKey = `grass_${size}`;
    if (this.cachedTextures[cacheKey]) {
      return this.cachedTextures[cacheKey];
    }
    
    const gl = this.gl;
    const data = new Uint8Array(size * size * 4);
    
    // Enhanced terrain texture with more variety
    const baseR = 40;
    const baseG = 120;
    const baseB = 20;
    
    // Create more detailed shades for better terrain variation
    const shades = [
      [baseR, baseG, baseB],          // Base green
      [baseR, baseG + 20, baseB],     // Lighter green
      [baseR - 10, baseG - 15, baseB - 5], // Darker green
      [baseR + 5, baseG + 30, baseB + 5],  // Highlight green
      [baseR - 5, baseG + 5, baseB - 10],  // Variation 1
      [baseR + 10, baseG + 10, baseB - 5], // Variation 2
      [baseR - 8, baseG + 8, baseB + 2],   // Variation 3
      [baseR + 15, baseG - 5, baseB - 2],  // Variation 4
      [110, 100, 60],                 // Sandy/dirt color
      [150, 140, 100],                // Light sandy color
      [80, 70, 50],                   // Dark dirt
      [90, 120, 60]                   // Moss-like color
    ];
    
    // Create a more detailed pattern with larger regions
    const gridSize = 8; // Increased from 4 to 8 for larger pattern areas
    const blockSize = Math.floor(size / gridSize);
    
    // Generate Perlin-like noise for smooth transitions
    const noise = new Array(size);
    for (let i = 0; i < size; i++) {
      noise[i] = new Array(size);
      for (let j = 0; j < size; j++) {
        // Multi-octave noise for more natural patterns
        const nx = i / (size / 4); // Scaled coordinates
        const ny = j / (size / 4);
        
        // Simple noise approximation
        let value = Math.sin(nx * 0.5) * Math.cos(ny * 0.5) * 0.5; // Large features
        value += Math.sin(nx * 2.0) * Math.cos(ny * 2.0) * 0.25;   // Medium features
        value += Math.sin(nx * 4.0) * Math.cos(ny * 4.0) * 0.125;  // Small features
        
        // Normalize to 0-1 range
        value = (value + 1) * 0.5;
        noise[i][j] = value;
      }
    }
    
    // Fill the texture with varied terrain colors
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        // Get noise value for this pixel
        const noiseValue = noise[x][y];
        
        // Base shade index from block position
        const blockX = Math.floor(x / blockSize);
        const blockY = Math.floor(y / blockSize);
        const blockIndex = (blockY * gridSize + blockX) % (shades.length - 4); // Keep some shades for special features
        
        // Determine shade based on noise value
        let shadeIndex;
        if (noiseValue < 0.2) {
          // Low areas - dirt/sand
          shadeIndex = 8 + Math.floor(noiseValue * 15) % 4; // Use the last 4 colors
        } else if (noiseValue > 0.8) {
          // High areas - bright green
          shadeIndex = 2 + (blockIndex % 3);
        } else {
          // Mid-range - standard grass
          shadeIndex = blockIndex;
        }
        
        // Add small-scale noise for texture
        const smallNoise = (x * 7 + y * 13) % 17;
        if (smallNoise < 2) {
          shadeIndex = (shadeIndex + 2) % shades.length;
        }
        
        const shade = shades[shadeIndex];
        const pixelIndex = (y * size + x) * 4;
        
        // Apply slight random variations (+/- 5) for natural look
        const randomVariation = Math.floor(Math.random() * 10) - 5;
        
        data[pixelIndex] = Math.max(0, Math.min(255, shade[0] + randomVariation));
        data[pixelIndex + 1] = Math.max(0, Math.min(255, shade[1] + randomVariation));
        data[pixelIndex + 2] = Math.max(0, Math.min(255, shade[2] + randomVariation));
        data[pixelIndex + 3] = 255;
      }
    }
    
    // Use the sharp texture creation for grass
    const texture = this.createSharpTextureFromData(data, size, size);
    this.cachedTextures[cacheKey] = texture;
    return texture;
  }
  
  // Generate an ultra-simplified sky texture
  createSkyTexture(size = this.textureSize) {
    // Cache key for this texture
    const cacheKey = `sky_${size}`;
    if (this.cachedTextures[cacheKey]) {
      return this.cachedTextures[cacheKey];
    }
    
    const gl = this.gl;
    const data = new Uint8Array(size * size * 4);
    
    // Just use two colors - top and bottom
    const topColor = [135, 206, 235];
    const bottomColor = [100, 160, 235];
    
    // Fill top half
    for (let y = 0; y < size/2; y++) {
      for (let x = 0; x < size; x++) {
        const pixelIndex = (y * size + x) * 4;
        data[pixelIndex] = topColor[0];
        data[pixelIndex + 1] = topColor[1];
        data[pixelIndex + 2] = topColor[2];
        data[pixelIndex + 3] = 255;
      }
    }
    
    // Fill bottom half
    for (let y = size/2; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const pixelIndex = (y * size + x) * 4;
        data[pixelIndex] = bottomColor[0];
        data[pixelIndex + 1] = bottomColor[1];
        data[pixelIndex + 2] = bottomColor[2];
        data[pixelIndex + 3] = 255;
      }
    }
    
    const texture = this.createTextureFromData(data, size, size);
    this.cachedTextures[cacheKey] = texture;
    return texture;
  }
  
  // Generate an ultra-simplified wood texture
  createWoodTexture(size = this.textureSize, darkWoodColor = [120, 81, 45], lightWoodColor = [184, 135, 95]) {
    // Cache key for this texture
    const cacheKey = `wood_${size}_${darkWoodColor.join('_')}_${lightWoodColor.join('_')}`;
    if (this.cachedTextures[cacheKey]) {
      return this.cachedTextures[cacheKey];
    }
    
    const gl = this.gl;
    const data = new Uint8Array(size * size * 4);
    
    // Use just 3 alternating stripes
    const stripeCount = 3;
    const stripeWidth = Math.ceil(size / stripeCount);
    
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        // Determine which color to use based on position
        const stripeIndex = Math.floor(x / stripeWidth) % 2; 
        const color = stripeIndex === 0 ? darkWoodColor : lightWoodColor;
        
        const pixelIndex = (y * size + x) * 4;
        data[pixelIndex] = color[0];
        data[pixelIndex + 1] = color[1];
        data[pixelIndex + 2] = color[2];
        data[pixelIndex + 3] = 255;
      }
    }
    
    const texture = this.createTextureFromData(data, size, size);
    this.cachedTextures[cacheKey] = texture;
    return texture;
  }
  
  // Generate a Minecraft-style leaves texture
  createLeavesTexture(size = this.textureSize) {
    // Cache key for this texture
    const cacheKey = `leaves_${size}`;
    if (this.cachedTextures[cacheKey]) {
      return this.cachedTextures[cacheKey];
    }
    
    const gl = this.gl;
    const data = new Uint8Array(size * size * 4);
    
    // Different shades of green for leaves
    const leafColors = [
      [48, 104, 32],  // Dark green
      [58, 124, 42],  // Medium green
      [68, 144, 52],  // Light green
      [54, 114, 38]   // Another shade
    ];
    
    // Add some darker spots to create texture
    const darkSpotColor = [30, 80, 20]; // Darker green for depth
    
    // Pre-compute a pattern for better performance
    const spotPattern = new Array(size * size);
    
    // Generate a deterministic pattern of darker spots
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        // Default to no spot
        spotPattern[y * size + x] = false;
        
        // Create a pattern of spots
        if ((x * y) % 13 === 0 || (x + y) % 17 === 0) {
          spotPattern[y * size + x] = true;
        }
      }
    }
    
    // Fill the texture with the leaf color pattern
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        // Select a shade based on position
        const colorIndex = ((x >> 2) + (y >> 2)) % 4;
        const pixelIndex = (y * size + x) * 4;
        
        // Use dark spot or normal leaf color based on the pattern
        const color = spotPattern[y * size + x] ? darkSpotColor : leafColors[colorIndex];
        
        data[pixelIndex] = color[0];
        data[pixelIndex + 1] = color[1];
        data[pixelIndex + 2] = color[2];
        data[pixelIndex + 3] = 255; // Fully opaque
      }
    }
    
    const texture = this.createTextureFromData(data, size, size);
    this.cachedTextures[cacheKey] = texture;
    return texture;
  }
  
  // Generate a Minecraft-style grass top texture
  createMinecraftGrassTexture(size = this.textureSize) {
    // Cache key for this texture
    const cacheKey = `minecraft_grass_${size}`;
    if (this.cachedTextures[cacheKey]) {
      return this.cachedTextures[cacheKey];
    }
    
    // Clear buffer data
    const data = new Uint8Array(size * size * 4);
    this.fillMinecraftGrassTextureData(data, size);
    
    // Use the sharp texture creation for grass
    const texture = this.createSharpTextureFromData(data, size, size);
    this.cachedTextures[cacheKey] = texture;
    return texture;
  }
  
  // Fill buffer with minecraft grass texture data
  fillMinecraftGrassTextureData(buffer, size) {
    // These settings are fine and don't need to be updated
    // Minecraft-style grass texture is separate from our terrain texture
    
    // Define colors
    const dirt = [102, 67, 33];
    const grass = [32, 162, 32];
    const darkGrass = [22, 130, 22];
    
    // Randomness value
    const randomness = 30;
    
    // Fill dirt base
    for (let i = 0; i < size * size * 4; i += 4) {
      // Get random variation for the dirt
      const r = dirt[0] + Math.floor(Math.random() * randomness) - randomness/2;
      const g = dirt[1] + Math.floor(Math.random() * randomness) - randomness/2;
      const b = dirt[2] + Math.floor(Math.random() * randomness) - randomness/2;
      
      buffer[i] = r;
      buffer[i+1] = g;
      buffer[i+2] = b;
      buffer[i+3] = 255;
    }
    
    // Add grass on top and pixels that go down the sides
    const grassHeight = Math.floor(size * 0.55); // 55% of the texture is grass
    
    for (let y = 0; y < grassHeight; y++) {
      for (let x = 0; x < size; x++) {
        // Lower grass densities as we get closer to the bottom of the grass section
        const grassDensity = (grassHeight - y) / grassHeight;
        
        // Random value to determine if we add grass here
        const randomValue = Math.random();
        
        // Decide to place grass based on the height-dependent density
        if (randomValue < grassDensity * 0.8) {
          // Add some darker grass bits randomly
          const useColor = Math.random() < 0.3 ? darkGrass : grass;
          
          // Get random variation for the grass
          const r = useColor[0] + Math.floor(Math.random() * randomness) - randomness/2;
          const g = useColor[1] + Math.floor(Math.random() * randomness) - randomness/2;
          const b = useColor[2] + Math.floor(Math.random() * randomness) - randomness/2;
          
          // Place the grass
          const index = (y * size + x) * 4;
          buffer[index] = r;
          buffer[index+1] = g;
          buffer[index+2] = b;
          buffer[index+3] = 255;
        }
      }
    }
  }
  
  // Fill buffer with grass texture data
  fillGrassTextureData(buffer, size) {
    // Enhanced terrain texture with more variety
    const baseR = 40;
    const baseG = 120;
    const baseB = 20;
    
    // Create more detailed shades for better terrain variation
    const shades = [
      [baseR, baseG, baseB],          // Base green
      [baseR, baseG + 20, baseB],     // Lighter green
      [baseR - 10, baseG - 15, baseB - 5], // Darker green
      [baseR + 5, baseG + 30, baseB + 5],  // Highlight green
      [baseR - 5, baseG + 5, baseB - 10],  // Variation 1
      [baseR + 10, baseG + 10, baseB - 5], // Variation 2
      [baseR - 8, baseG + 8, baseB + 2],   // Variation 3
      [baseR + 15, baseG - 5, baseB - 2],  // Variation 4
      [110, 100, 60],                 // Sandy/dirt color
      [150, 140, 100],                // Light sandy color
      [80, 70, 50],                   // Dark dirt
      [90, 120, 60]                   // Moss-like color
    ];
    
    // Create a more detailed pattern with larger regions
    const gridSize = 8; // Increased for larger pattern areas
    const blockSize = Math.floor(size / gridSize);
    
    // Generate simple noise values
    const noise = new Array(size);
    for (let i = 0; i < size; i++) {
      noise[i] = new Array(size);
      for (let j = 0; j < size; j++) {
        // Multi-octave noise for more natural patterns
        const nx = i / (size / 4); // Scaled coordinates
        const ny = j / (size / 4);
        
        // Simple noise approximation
        let value = Math.sin(nx * 0.5) * Math.cos(ny * 0.5) * 0.5; // Large features
        value += Math.sin(nx * 2.0) * Math.cos(ny * 2.0) * 0.25;   // Medium features
        value += Math.sin(nx * 4.0) * Math.cos(ny * 4.0) * 0.125;  // Small features
        
        // Normalize to 0-1 range
        value = (value + 1) * 0.5;
        noise[i][j] = value;
      }
    }
    
    // Fill the texture with varied terrain colors
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        // Get noise value for this pixel
        const noiseValue = noise[x][y];
        
        // Base shade index from block position
        const blockX = Math.floor(x / blockSize);
        const blockY = Math.floor(y / blockSize);
        const blockIndex = (blockY * gridSize + blockX) % (shades.length - 4); // Keep some shades for special features
        
        // Determine shade based on noise value
        let shadeIndex;
        if (noiseValue < 0.2) {
          // Low areas - dirt/sand
          shadeIndex = 8 + Math.floor(noiseValue * 15) % 4; // Use the last 4 colors
        } else if (noiseValue > 0.8) {
          // High areas - bright green
          shadeIndex = 2 + (blockIndex % 3);
        } else {
          // Mid-range - standard grass
          shadeIndex = blockIndex;
        }
        
        // Add small-scale noise for texture
        const smallNoise = (x * 7 + y * 13) % 17;
        if (smallNoise < 2) {
          shadeIndex = (shadeIndex + 2) % shades.length;
        }
        
        const shade = shades[shadeIndex];
        const pixelIndex = (y * size + x) * 4;
        
        // Apply slight random variations (+/- 5) for natural look
        const randomVariation = Math.floor(Math.random() * 10) - 5;
        
        buffer[pixelIndex] = Math.max(0, Math.min(255, shade[0] + randomVariation));
        buffer[pixelIndex + 1] = Math.max(0, Math.min(255, shade[1] + randomVariation));
        buffer[pixelIndex + 2] = Math.max(0, Math.min(255, shade[2] + randomVariation));
        buffer[pixelIndex + 3] = 255;
      }
    }
  }
  
  // Fill buffer with dirt texture data
  fillDirtTextureData(buffer, size) {
    // Base dirt colors
    const dirtColors = [
      [139, 101, 57],  // Medium brown
      [120, 85, 45],   // Dark brown
      [150, 110, 65],  // Light brown
      [125, 93, 50]    // Another brown shade
    ];
    
    // Create a simple dirt texture with some variation
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        // Use a simple hash function to pick a color
        const colorIndex = (x * 7 + y * 13) % dirtColors.length;
        const color = dirtColors[colorIndex];
        
        // Add some noise for texture
        const noise = Math.floor(Math.random() * 10) - 5;
        
        const pixelIndex = (y * size + x) * 4;
        buffer[pixelIndex] = Math.max(0, Math.min(255, color[0] + noise));
        buffer[pixelIndex + 1] = Math.max(0, Math.min(255, color[1] + noise));
        buffer[pixelIndex + 2] = Math.max(0, Math.min(255, color[2] + noise));
        buffer[pixelIndex + 3] = 255;
      }
    }
  }
  
  // Generate all textures needed for the application
  generateAllTextures() {
    // Check if textures are already generated to prevent freezing on refresh
    if (this.textureGenerationComplete || Object.keys(this.cachedTextures).length > 0) {
      return this.cachedTextures;
    }
    
    // Pre-allocate texture data array once for all textures
    const size = this.textureSize;
    const bufferSize = size * size * 4;
    const sharedBuffer = new Uint8Array(bufferSize);
    
    try {
      // Generate textures in batch using the shared buffer for better performance
      // Sky texture (simple gradient)
      this.fillSkyTextureData(sharedBuffer, size);
      this.cachedTextures['sky'] = this.createTextureFromData(sharedBuffer, size, size);
      
      // Ground texture (simple green pattern) - use sharp texture for grass
      this.fillGrassTextureData(sharedBuffer, size);
      this.cachedTextures['ground'] = this.createSharpTextureFromData(sharedBuffer, size, size);
      
      // Dirt texture
      this.fillDirtTextureData(sharedBuffer, size);
      this.cachedTextures['dirt'] = this.createTextureFromData(sharedBuffer, size, size);
      
      // Minecraft grass texture - use sharp texture for grass
      this.fillMinecraftGrassTextureData(sharedBuffer, size);
      this.cachedTextures['minecraft_grass'] = this.createSharpTextureFromData(sharedBuffer, size, size);
      
      // Wall texture (brick pattern)
      this.fillBrickTextureData(sharedBuffer, size);
      this.cachedTextures['wall'] = this.createTextureFromData(sharedBuffer, size, size);
      
      // Brick texture
      this.fillBrickTextureData(sharedBuffer, size);
      this.cachedTextures['brick'] = this.createTextureFromData(sharedBuffer, size, size);
      
      // Stone texture (use checker as placeholder)
      this.fillCheckerTextureData(sharedBuffer, size);
      this.cachedTextures['stone'] = this.createTextureFromData(sharedBuffer, size, size);
      
      // Wood texture (simplified stripes)
      this.fillWoodTextureData(sharedBuffer, size);
      this.cachedTextures['wood'] = this.createTextureFromData(sharedBuffer, size, size);
      
      // Leaves texture (simplified green pattern) - use sharp texture for leaves as well
      this.fillLeavesTextureData(sharedBuffer, size);
      this.cachedTextures['leaves'] = this.createSharpTextureFromData(sharedBuffer, size, size);
      
      this.textureGenerationComplete = true;
    } catch (e) {
      console.error("Error generating textures:", e);
    }
    
    return this.cachedTextures;
  }
  
  // Fill buffer with sky texture data
  fillSkyTextureData(buffer, size) {
    const topColor = [135, 206, 235];
    const bottomColor = [100, 160, 235];
    
    for (let y = 0; y < size; y++) {
      // Simple linear gradient
      const t = y / size;
      const r = Math.floor(topColor[0] * (1 - t) + bottomColor[0] * t);
      const g = Math.floor(topColor[1] * (1 - t) + bottomColor[1] * t);
      const b = Math.floor(topColor[2] * (1 - t) + bottomColor[2] * t);
      
      for (let x = 0; x < size; x++) {
        const pixelIndex = (y * size + x) * 4;
        buffer[pixelIndex] = r;
        buffer[pixelIndex + 1] = g;
        buffer[pixelIndex + 2] = b;
        buffer[pixelIndex + 3] = 255;
      }
    }
  }
  
  // Fill buffer with brick texture data
  fillBrickTextureData(buffer, size) {
    const brickColor = [180, 60, 60];
    const mortarColor = [200, 200, 200];
    
    // Simplified brick pattern
    const brickWidth = size / 2;
    const brickHeight = size / 2;
    const mortarSize = 2;
    
    // Fill with brick color first
    for (let i = 0; i < size * size * 4; i += 4) {
      buffer[i] = brickColor[0];
      buffer[i + 1] = brickColor[1];
      buffer[i + 2] = brickColor[2];
      buffer[i + 3] = 255;
    }
    
    // Add mortar lines
    for (let y = 0; y < size; y++) {
      const isMortarY = y % brickHeight < mortarSize;
      
      for (let x = 0; x < size; x++) {
        const row = Math.floor(y / brickHeight);
        const offset = (row % 2) * (brickWidth / 2);
        const adjustedX = (x + offset) % size;
        const isMortarX = adjustedX % brickWidth < mortarSize;
        
        if (isMortarX || isMortarY) {
          const pixelIndex = (y * size + x) * 4;
          buffer[pixelIndex] = mortarColor[0];
          buffer[pixelIndex + 1] = mortarColor[1];
          buffer[pixelIndex + 2] = mortarColor[2];
        }
      }
    }
  }
  
  // Fill buffer with checker texture data
  fillCheckerTextureData(buffer, size) {
    const color1 = [200, 200, 200];
    const color2 = [100, 100, 100];
    const blockSize = size / 2;
    
    // Fill with a checker pattern
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const blockX = Math.floor(x / blockSize);
        const blockY = Math.floor(y / blockSize);
        const isColor1 = (blockX + blockY) % 2 === 0;
        const color = isColor1 ? color1 : color2;
        
        const pixelIndex = (y * size + x) * 4;
        buffer[pixelIndex] = color[0];
        buffer[pixelIndex + 1] = color[1];
        buffer[pixelIndex + 2] = color[2];
        buffer[pixelIndex + 3] = 255;
      }
    }
  }
  
  // Fill buffer with wood texture data
  fillWoodTextureData(buffer, size) {
    const darkWoodColor = [120, 81, 45];
    const lightWoodColor = [184, 135, 95];
    
    // Simplified wood stripes
    const stripeCount = 2; // Reduced from 3 to 2
    const stripeWidth = Math.ceil(size / stripeCount);
    
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        // Determine which color to use based on position
        const stripeIndex = Math.floor(x / stripeWidth) % 2; 
        const color = stripeIndex === 0 ? darkWoodColor : lightWoodColor;
        
        const pixelIndex = (y * size + x) * 4;
        buffer[pixelIndex] = color[0];
        buffer[pixelIndex + 1] = color[1];
        buffer[pixelIndex + 2] = color[2];
        buffer[pixelIndex + 3] = 255;
      }
    }
  }
  
  // Fill buffer with leaves texture data
  fillLeavesTextureData(buffer, size) {
    // Different shades of green for leaves
    const leafColors = [
      [48, 104, 32],  // Dark green
      [58, 124, 42],  // Medium green
      [68, 144, 52],  // Light green
      [54, 114, 38]   // Another shade
    ];
    
    // Add some darker spots to create texture
    const darkSpotColor = [30, 80, 20]; // Darker green for depth
    
    // Create a deterministic pattern without pre-computation
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        // Select a shade based on position
        const colorIndex = ((x >> 2) + (y >> 2)) % 4;
        
        // Determine if this should be a darker spot (simple pattern)
        const isDarkSpot = (x * y) % 13 === 0 || (x + y) % 17 === 0;
        const color = isDarkSpot ? darkSpotColor : leafColors[colorIndex];
        
        const pixelIndex = (y * size + x) * 4;
        buffer[pixelIndex] = color[0];
        buffer[pixelIndex + 1] = color[1];
        buffer[pixelIndex + 2] = color[2];
        buffer[pixelIndex + 3] = 255;
      }
    }
  }
} 