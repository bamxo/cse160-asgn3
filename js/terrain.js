// Terrain class for creating and managing terrain meshes
class Terrain {
  constructor(gl, width = 64, depth = 64, scale = 1.0, maxHeight = 5.0) {
    this.gl = gl;
    this.width = width;
    this.depth = depth;
    this.scale = scale;
    this.maxHeight = maxHeight;
    
    // Build heightmap
    this.heightmap = this.generateHeightmap();
    
    // Create vertices, indices, normals, etc.
    this.vertices = null;
    this.indices = null;
    this.normals = null;
    this.texCoords = null;
    
    // Generate mesh
    this.buildMesh();
    
    // Buffer objects - will be initialized later
    this.vertexBuffer = null;
    this.indexBuffer = null;
    this.normalBuffer = null;
    this.texCoordBuffer = null;
    this.buffersInitialized = false;
    
    // Texture parameters
    this.textured = false;
    this.textureID = 0;
    
    // Cache matrix to avoid creating new ones
    this.localMatrix = new Matrix4();
  }
  
  // Generate a simple heightmap
  generateHeightmap() {
    const heightmap = new Array(this.width + 1);
    
    for (let x = 0; x <= this.width; x++) {
      heightmap[x] = new Array(this.depth + 1);
      
      for (let z = 0; z <= this.depth; z++) {
        // Generate height using Perlin-like noise
        let height = 0;
        
        // Base height - create some gentle rolling hills with reduced amplitude
        height += Math.sin(x * 0.1) * Math.cos(z * 0.1) * 0.3; // Reduced from 0.5 to 0.3
        
        // Add medium frequency variation with reduced amplitude
        height += Math.sin(x * 0.3 + z * 0.2) * 0.2; // Reduced from 0.3 to 0.2
        
        // Add high frequency small details with reduced amplitude
        height += Math.sin(x * 0.7 + z * 0.6) * 0.1; // Reduced from 0.15 to 0.1
        
        // Add a few random peaks but with lower heights
        const dx1 = x - this.width * 0.3;
        const dz1 = z - this.depth * 0.7;
        const dx2 = x - this.width * 0.7;
        const dz2 = z - this.depth * 0.4;
        const d1 = Math.sqrt(dx1*dx1 + dz1*dz1);
        const d2 = Math.sqrt(dx2*dx2 + dz2*dz2);
        
        height += Math.max(0, 2.0 - d1/8) * 1.0; // Reduced from 2.0 to 1.0
        height += Math.max(0, 1.5 - d2/10) * 1.0; // Reduced from 2.5 to 1.0
        
        // Scale height and ensure it's non-negative
        height = Math.max(0, height * (this.maxHeight * 0.6)); // Reduce max height by 40%
        
        // Create flat areas for spawning pandas and starting point
        // Center of the map (for player spawn)
        const centerX = this.width / 2;
        const centerZ = this.depth / 2;
        const distFromCenter = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(z - centerZ, 2));
        if (distFromCenter < 5) {
          // Flatten the center area
          height = 0;
        }
        
        // Panda area (offset from center)
        const pandaX = centerX + 2;
        const pandaZ = centerZ + 2;
        const distFromPanda = Math.sqrt(Math.pow(x - pandaX, 2) + Math.pow(z - pandaZ, 2));
        if (distFromPanda < 3) {
          // Flatten the panda area
          height = 0;
        }
        
        // Store in heightmap
        heightmap[x][z] = height;
      }
    }
    
    // Smooth the heightmap to avoid steep slopes
    this.smoothHeightmap(heightmap);
    
    return heightmap;
  }
  
  // Smooth the heightmap to make it more walkable
  smoothHeightmap(heightmap) {
    const smoothed = new Array(this.width + 1);
    for (let x = 0; x <= this.width; x++) {
      smoothed[x] = new Array(this.depth + 1);
    }
    
    // Apply a simple box blur
    for (let x = 0; x <= this.width; x++) {
      for (let z = 0; z <= this.depth; z++) {
        let sum = 0;
        let count = 0;
        
        // Sample neighbors in a 3x3 area
        for (let dx = -1; dx <= 1; dx++) {
          for (let dz = -1; dz <= 1; dz++) {
            const nx = x + dx;
            const nz = z + dz;
            
            if (nx >= 0 && nx <= this.width && nz >= 0 && nz <= this.depth) {
              sum += heightmap[nx][nz];
              count++;
            }
          }
        }
        
        // Set the smoothed height
        smoothed[x][z] = sum / count;
      }
    }
    
    // Copy the smoothed values back to the original heightmap
    for (let x = 0; x <= this.width; x++) {
      for (let z = 0; z <= this.depth; z++) {
        heightmap[x][z] = smoothed[x][z];
      }
    }
  }
  
  // Build the terrain mesh using the heightmap
  buildMesh() {
    // Create arrays for vertex data
    const vertexCount = (this.width + 1) * (this.depth + 1);
    const vertices = new Float32Array(vertexCount * 3);
    const normals = new Float32Array(vertexCount * 3);
    const texCoords = new Float32Array(vertexCount * 2);
    
    // Create arrays for index data (2 triangles per grid cell)
    const faceCount = this.width * this.depth * 2;
    const indices = new Uint16Array(faceCount * 3);
    
    // Generate vertices with heights from the heightmap
    let vertexIndex = 0;
    for (let z = 0; z <= this.depth; z++) {
      for (let x = 0; x <= this.width; x++) {
        // Position
        const xPos = (x - this.width/2) * this.scale;
        const yPos = this.heightmap[x][z];
        const zPos = (z - this.depth/2) * this.scale;
        
        vertices[vertexIndex * 3] = xPos;
        vertices[vertexIndex * 3 + 1] = yPos;
        vertices[vertexIndex * 3 + 2] = zPos;
        
        // Texture coordinates - simple mapping across the terrain
        texCoords[vertexIndex * 2] = x / this.width * 4;  // Repeat texture 4 times
        texCoords[vertexIndex * 2 + 1] = z / this.depth * 4;
        
        vertexIndex++;
      }
    }
    
    // Generate triangle indices
    let indexIndex = 0;
    for (let z = 0; z < this.depth; z++) {
      for (let x = 0; x < this.width; x++) {
        // Get the indices of the corners of this grid cell
        const topLeft = z * (this.width + 1) + x;
        const topRight = topLeft + 1;
        const bottomLeft = (z + 1) * (this.width + 1) + x;
        const bottomRight = bottomLeft + 1;
        
        // Triangle 1 (top-right half)
        indices[indexIndex++] = topLeft;
        indices[indexIndex++] = bottomLeft;
        indices[indexIndex++] = topRight;
        
        // Triangle 2 (bottom-left half)
        indices[indexIndex++] = topRight;
        indices[indexIndex++] = bottomLeft;
        indices[indexIndex++] = bottomRight;
      }
    }
    
    // Calculate normals
    // For each vertex, average the normals of adjacent faces
    // Reset the normal array first
    for (let i = 0; i < normals.length; i++) {
      normals[i] = 0;
    }
    
    // Calculate face normals and add to vertex normals
    for (let i = 0; i < indices.length; i += 3) {
      const i0 = indices[i];
      const i1 = indices[i + 1];
      const i2 = indices[i + 2];
      
      // Get the three points of the triangle
      const v0 = [
        vertices[i0 * 3],
        vertices[i0 * 3 + 1],
        vertices[i0 * 3 + 2]
      ];
      
      const v1 = [
        vertices[i1 * 3],
        vertices[i1 * 3 + 1],
        vertices[i1 * 3 + 2]
      ];
      
      const v2 = [
        vertices[i2 * 3],
        vertices[i2 * 3 + 1],
        vertices[i2 * 3 + 2]
      ];
      
      // Calculate vectors from point 0
      const vec1 = [
        v1[0] - v0[0],
        v1[1] - v0[1],
        v1[2] - v0[2]
      ];
      
      const vec2 = [
        v2[0] - v0[0],
        v2[1] - v0[1],
        v2[2] - v0[2]
      ];
      
      // Cross product for normal
      const normal = [
        vec1[1] * vec2[2] - vec1[2] * vec2[1],
        vec1[2] * vec2[0] - vec1[0] * vec2[2],
        vec1[0] * vec2[1] - vec1[1] * vec2[0]
      ];
      
      // Add this normal to the 3 vertices
      normals[i0 * 3] += normal[0];
      normals[i0 * 3 + 1] += normal[1];
      normals[i0 * 3 + 2] += normal[2];
      
      normals[i1 * 3] += normal[0];
      normals[i1 * 3 + 1] += normal[1];
      normals[i1 * 3 + 2] += normal[2];
      
      normals[i2 * 3] += normal[0];
      normals[i2 * 3 + 1] += normal[1];
      normals[i2 * 3 + 2] += normal[2];
    }
    
    // Normalize all normals
    for (let i = 0; i < vertexCount; i++) {
      const x = normals[i * 3];
      const y = normals[i * 3 + 1];
      const z = normals[i * 3 + 2];
      
      const length = Math.sqrt(x*x + y*y + z*z);
      
      if (length > 0) {
        normals[i * 3] = x / length;
        normals[i * 3 + 1] = y / length;
        normals[i * 3 + 2] = z / length;
      } else {
        // Default normal if calculation failed
        normals[i * 3] = 0;
        normals[i * 3 + 1] = 1;
        normals[i * 3 + 2] = 0;
      }
    }
    
    // Store the generated data
    this.vertices = vertices;
    this.indices = indices;
    this.normals = normals;
    this.texCoords = texCoords;
  }
  
  // Set up texture parameters
  enableTexture(textureID) {
    this.textured = true;
    this.textureID = textureID;
  }
  
  disableTexture() {
    this.textured = false;
  }
  
  // Initialize buffers - call this once
  initBuffers(gl) {
    if (this.buffersInitialized) return;
    
    // Create and bind buffer for vertex positions
    this.vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.vertices, gl.STATIC_DRAW);
    
    // Create and bind buffer for indices
    this.indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indices, gl.STATIC_DRAW);
    
    // Create and bind buffer for normals
    this.normalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.normals, gl.STATIC_DRAW);
    
    // Create and bind buffer for texture coordinates
    this.texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.texCoords, gl.STATIC_DRAW);
    
    this.buffersInitialized = true;
  }
  
  // Fast render method - optimized to reduce operations
  render(gl, modelMatrix, viewMatrix, projectionMatrix, u_ModelMatrix, u_ViewMatrix, u_ProjectionMatrix, u_Color, u_TextureWeight, u_Sampler) {
    // Make sure buffers are initialized
    this.initBuffers(gl);
    
    // Set model matrix
    this.localMatrix.set(modelMatrix);
    gl.uniformMatrix4fv(u_ModelMatrix, false, this.localMatrix.elements);
    
    // Set color (default ground color)
    gl.uniform3fv(u_Color, [0.5, 0.8, 0.5]);
    
    // Set texture weight (0 = color only, 1 = texture only)
    gl.uniform1f(u_TextureWeight, this.textured ? 1.0 : 0.0);
    
    // Set the active texture if textured
    if (this.textured) {
      gl.uniform1i(u_Sampler, this.textureID);
    }
    
    // Set position attribute
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.vertexAttribPointer(gl.getAttribLocation(gl.program, 'a_Position'), 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(gl.getAttribLocation(gl.program, 'a_Position'));
    
    // Set normal attribute
    gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
    gl.vertexAttribPointer(gl.getAttribLocation(gl.program, 'a_Normal'), 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(gl.getAttribLocation(gl.program, 'a_Normal'));
    
    // Set texture coordinates
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.vertexAttribPointer(gl.getAttribLocation(gl.program, 'a_TexCoord'), 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(gl.getAttribLocation(gl.program, 'a_TexCoord'));
    
    // Bind index buffer
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    
    // Draw the terrain
    gl.drawElements(gl.TRIANGLES, this.indices.length, gl.UNSIGNED_SHORT, 0);
  }
  
  // Get the height at a specific world position
  getHeightAt(x, z) {
    // Convert from world coordinates to heightmap coordinates
    const hmX = Math.floor(x + this.width/2);
    const hmZ = Math.floor(z + this.depth/2);
    
    // Make sure coordinates are in bounds
    if (hmX < 0 || hmX >= this.width || hmZ < 0 || hmZ >= this.depth) {
      return 0;
    }
    
    // Get the height from the heightmap
    return this.heightmap[hmX][hmZ];
  }
} 