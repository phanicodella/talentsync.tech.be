const express = require('express');
const fetch = require('node-fetch');
const router = express.Router();

router.post('/analyze', async (req, res) => {
   try {
       if (!process.env.OPENAI_API_KEY) {
           return res.status(500).json({ 
               error: 'OpenAI API key not configured',
               status: 'error'
           });
       }

       const { transcript } = req.body;
       if (!transcript || transcript.trim().length === 0) {
           return res.status(400).json({ 
               error: 'Transcript is required',
               status: 'error'
           });
       }

       const response = await fetch('https://api.openai.com/v1/chat/completions', {
           method: 'POST',
           headers: {
               'Content-Type': 'application/json',
               'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
           },
           body: JSON.stringify({
               model: "gpt-4",
               messages: [{
                   role: 'system',
                   content: `You are an expert interview assessor. Analyze this interview transcript for a job interview. 
                   Evaluate the candidate's responses and provide structured insights about their performance.
                   Parse the responses carefully and assess:
                   - Level of engagement and interest
                   - Quality and depth of answers
                   - Communication style and clarity
                   - Professional attitude
                   - Technical competency signals
                   
                   Return your analysis in this exact JSON format:
                   {
                       "key_traits": {
                           "confidence": <number between 0 and 1>,
                           "clarity": <number between 0 and 1>,
                           "technical_knowledge": <number between 0 and 1>,
                           "communication": <number between 0 and 1>,
                           "leadership": <number between 0 and 1>
                       },
                       "behavioral_flags": [
                           <list of observed behaviors>,
                           <minimum 3 specific observations>
                       ],
                       "risk_factors": [
                           <list of concerns>,
                           <minimum 2 specific risks>
                       ],
                       "recommendations": [
                           <list of actionable recommendations>,
                           <minimum 3 specific recommendations>
                       ],
                       "detailed_analysis": {
                           "response_depth": <number between 0 and 1>,
                           "emotional_intelligence": <number between 0 and 1>,
                           "problem_solving_approach": <string describing approach>
                       }
                   }`
               }, {
                   role: 'user',
                   content: transcript
               }],
               temperature: 0.4,
               max_tokens: 1500
           })
       });

       if (!response.ok) {
           const errorText = await response.text();
           console.error('OpenAI API Error Details:', {
               status: response.status,
               errorText,
               headers: response.headers.raw()
           });
           return res.status(response.status).json({ 
               error: 'OpenAI API request failed', 
               details: errorText,
               status: 'error'
           });
       }

       const data = await response.json();
       
       if (!data.choices?.[0]?.message?.content) {
           return res.status(500).json({ 
               error: 'Invalid response format from OpenAI',
               status: 'error'
           });
       }

       try {
           const parsedContent = JSON.parse(data.choices[0].message.content);
           
           // Additional validation
           const validateAnalysisStructure = (analysis) => {
               return (
                   analysis &&
                   analysis.key_traits &&
                   typeof analysis.key_traits.confidence === 'number' &&
                   typeof analysis.key_traits.clarity === 'number' &&
                   typeof analysis.key_traits.technical_knowledge === 'number' &&
                   typeof analysis.key_traits.communication === 'number' &&
                   typeof analysis.key_traits.leadership === 'number' &&
                   Array.isArray(analysis.behavioral_flags) &&
                   Array.isArray(analysis.risk_factors) &&
                   Array.isArray(analysis.recommendations)
               );
           };

           if (!validateAnalysisStructure(parsedContent)) {
               throw new Error('Invalid analysis structure');
           }

           res.json({
               ...parsedContent,
               status: 'success',
               processedAt: new Date().toISOString()
           });
       } catch (parseError) {
           console.error('JSON parsing error:', {
               error: parseError,
               rawContent: data.choices[0].message.content
           });
           res.status(500).json({ 
               error: 'Failed to parse OpenAI response',
               rawContent: data.choices[0].message.content,
               status: 'error'
           });
       }
   } catch (error) {
       console.error('Analysis error:', error);
       res.status(500).json({ 
           error: error.message,
           details: error.toString(),
           status: 'error'
       });
   }
});

router.post('/follow-up', async (req, res) => {
   try {
       if (!process.env.OPENAI_API_KEY) {
           return res.status(500).json({ 
               error: 'OpenAI API key not configured',
               status: 'error'
           });
       }

       const { transcript } = req.body;
       if (!transcript || transcript.trim().length === 0) {
           return res.status(400).json({ 
               error: 'Transcript is required',
               status: 'error'
           });
       }
       
       const response = await fetch('https://api.openai.com/v1/chat/completions', {
           method: 'POST',
           headers: {
               'Content-Type': 'application/json',
               'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
           },
           body: JSON.stringify({
               model: "gpt-4",
               messages: [{
                   role: 'system',
                   content: `Based on this interview transcript, generate exactly 3 thoughtful follow-up questions.
                   Analyze the candidate's responses and formulate questions that:
                   - Seek deeper insights into their experiences
                   - Explore potential gaps in their responses
                   - Provide an opportunity for more comprehensive understanding
                   
                   Guidelines:
                   1. Questions should be specific and context-driven
                   2. Avoid generic or repetitive questioning
                   3. Demonstrate critical thinking and depth of inquiry
                   
                   Format: Respond with a JSON array of 3 precisely crafted questions.`
               }, {
                   role: 'user',
                   content: transcript
               }],
               temperature: 0.7,
               max_tokens: 300
           })
       });

       if (!response.ok) {
           const errorText = await response.text();
           console.error('OpenAI API Error Details:', {
               status: response.status,
               errorText,
               headers: response.headers.raw()
           });
           return res.status(response.status).json({ 
               error: 'OpenAI API request failed', 
               details: errorText,
               status: 'error'
           });
       }

       const data = await response.json();
       
       if (!data.choices?.[0]?.message?.content) {
           return res.status(500).json({ 
               error: 'Invalid response format from OpenAI',
               status: 'error'
           });
       }

       try {
           const questions = JSON.parse(data.choices[0].message.content);
           
           res.json({
               questions: questions.slice(0, 3),
               status: 'success',
               processedAt: new Date().toISOString()
           });
       } catch (parseError) {
           console.error('JSON parsing error:', {
               error: parseError,
               rawContent: data.choices[0].message.content
           });
           res.status(500).json({ 
               error: 'Failed to parse follow-up questions',
               rawContent: data.choices[0].message.content,
               status: 'error'
           });
       }
   } catch (error) {
       console.error('Follow-up questions error:', error);
       res.status(500).json({
           error: error.message,
           details: error.toString(),
           status: 'error'
       });
   }
});

module.exports = router;