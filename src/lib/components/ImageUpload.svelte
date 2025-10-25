<script>
import { createEventDispatcher } from 'svelte'
import OpenAI from 'openai'

const dispatch = createEventDispatcher()

let fileInput
let dragActive = false
let loading = false
let error = null

// Initialize OpenAI client
// Note: In production, this should be done server-side to keep API key secure
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true, // Remove this and use server-side API in production
})

function handleFileSelect(event) {
  const file = event.target.files?.[0]
  if (file && file.type.startsWith('image/')) {
    handleImageUpload(file)
  }
}

function handleDrop(event) {
  event.preventDefault()
  dragActive = false

  const file = event.dataTransfer.files?.[0]
  if (file && file.type.startsWith('image/')) {
    handleImageUpload(file)
  }
}

function handleDragOver(event) {
  event.preventDefault()
  dragActive = true
}

function handleDragLeave() {
  dragActive = false
}

async function handleImageUpload(file) {
  loading = true
  error = null

  try {
    // Convert image to base64
    const base64Image = await fileToBase64(file)

    // Call OpenAI API with vision model
    const response = await openai.chat.completions.create({
      model: 'gpt-5',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extract the equipment name and enchants from this game equipment image. Look for:\n1. Equipment name (main title)\n2. Equipment subtype (subtitle in brackets like "[Battle Equipment - Elemental Stone]" or "[Battle Equipment - Sword]") - this is VERY important for weapons\n3. All enchants with "Lv. #" prefix\n\nReturn JSON with:\n- equipmentName: the main title\n- equipmentSubtype: the text in brackets below the title (if present)\n- enchants: array of enchant strings',
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${file.type};base64,${base64Image}`,
              },
            },
          ],
        },
      ],
    })

    const extractedText = response.choices[0]?.message?.content

    // Dispatch only the extracted text to parent component
    dispatch('upload', {
      extractedText,
    })

    console.log('Extraction result:', extractedText)
  } catch (err) {
    error = err.message
    console.error('Error processing image:', err)
    dispatch('error', { error: err.message })
  } finally {
    loading = false
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function triggerFileInput() {
  fileInput?.click()
}
</script>

<div
  class="image-upload-container"
  class:drag-active={dragActive}
  class:loading
  on:drop={handleDrop}
  on:dragover={handleDragOver}
  on:dragleave={handleDragLeave}
  role="button"
  tabindex="0"
  on:click={triggerFileInput}
  on:keydown={(e) => e.key === 'Enter' && triggerFileInput()}
>
  <input type="file" accept="image/*" bind:this={fileInput} on:change={handleFileSelect} style="display: none;" />

  <div class="upload-content">
    {#if loading}
      <div class="spinner"></div>
      <p class="upload-text">Processing image...</p>
      <p class="upload-hint">Extracting equipment data using AI</p>
    {:else if error}
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <p class="upload-text error-text">Error: {error}</p>
      <p class="upload-hint">Click to try again</p>
    {:else}
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="17 8 12 3 7 8"></polyline>
        <line x1="12" y1="3" x2="12" y2="15"></line>
      </svg>
      <p class="upload-text">Click or drag image to upload</p>
      <p class="upload-hint">Supports: JPG, PNG, GIF, etc.</p>
    {/if}
  </div>
</div>

<style>
.image-upload-container {
  border: 2px dashed #ccc;
  border-radius: 8px;
  padding: 2rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  background-color: #f9f9f9;
}

.image-upload-container:hover {
  border-color: #666;
  background-color: #f0f0f0;
}

.image-upload-container.drag-active {
  border-color: #4caf50;
  background-color: #e8f5e9;
}

.image-upload-container.loading {
  cursor: wait;
  border-color: #2196f3;
  background-color: #e3f2fd;
}

.upload-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.upload-content svg {
  color: #666;
}

.upload-text {
  margin: 0;
  font-size: 1rem;
  font-weight: 500;
  color: #333;
}

.error-text {
  color: #d32f2f;
}

.upload-hint {
  margin: 0;
  font-size: 0.875rem;
  color: #999;
}

.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid #e0e0e0;
  border-top: 4px solid #2196f3;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
