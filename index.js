const express = require('express');
const multer = require('multer');
const tesseract = require('tesseract.js');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const XRegExp = require('xregexp');
const dotenv=require('dotenv')
const app = express();
const port = 3001;
dotenv.config();
const upload = multer({ dest: 'uploads/' });
app.use(cors());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Function to extract text with OpenAI
const extractTextWithOpenAI = async (text) => {
  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are an expert in text cleaning and correction.'
        },
        {
          role: 'user',
          content: `The following text was extracted from an image using OCR. Please clean up the text, correct common OCR errors, such as misrecognized characters, misplaced spaces, and missing punctuation. Ensure the text is readable and coherent. Focus particularly on coordinates and numerical values. Here is the text:\n\n${text}`
        }
      ],
      max_tokens: 2000,
    }, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error processing text with OpenAI:', error.message);
    throw error;
  }
};

const extractDirectionsWithOpenAI = async (text) => {
  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-3.5-turbo', // or 'gpt-4' if available
      messages: [
        {
          role: 'system',
          content: 'You are an expert in text extraction and formatting.'
        },
        {
          role: 'user',
        //   content: `Extract the directions and distances from the following text and format them as NSdd°mm'EW distanceFT (e.g., S45°30'E 150.0FT). Here is the text:\n\n${text}`
        content: `Please extract the directions and distances from the following text and format them as NSdd°mm'EW distanceFT. Convert the directions to a more concise format without degrees or minutes, and round the distance to the nearest integer. For example, format 'S0°30'E 20.0FT' as 'S0E 20FT'. Here is the text:\n\n${text}.`

    }
      ],
      max_tokens: 2000,
    }, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const extractedText = response.data.choices[0].message.content.trim();
    console.log("extractedtext:::",extractedText)
    return extractedText;
  } catch (error) {
    console.error('Error processing text with OpenAI:', error.message);
    throw error;
  }
};



// Function to clean up files safely
const cleanUpFiles = async (filePaths) => {
  for (const filePath of filePaths) {
    try {
      await fs.unlink(filePath);
      console.log(`Successfully deleted ${filePath}`);
    } catch (error) {
      console.error(`Error deleting file ${filePath}:`, error.message);
    }
  }
};

app.post('/upload', upload.single('image'), async (req, res) => {
  const imagePath = req.file.path;
  console.log('Uploaded image path:', imagePath);

  try {
    // Perform OCR on the uploaded image
    const { data: { text } } = await tesseract.recognize(imagePath, 'eng', {
      logger: m => console.log(m),
    });

    // Process text with OpenAI
    const processedText = await extractTextWithOpenAI(text);
    const coordinates = await extractDirectionsWithOpenAI(processedText);

    // Clean up the uploaded file
    await cleanUpFiles([imagePath]);

    // Send the processed text and coordinates back to the client
    res.json({ ocrText: text, processedText, coordinates });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).send('An error occurred while processing the image.');
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
