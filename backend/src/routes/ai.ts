import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'

import { GoogleGenAI } from '@google/genai'

// Instantiate Gemini API. If GEMINI_API_KEY is not set, we will use a mock stream below.
const apiKey = process.env.GEMINI_API_KEY
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null

interface AIRequest {
  prompt: string
  context?: string
  role?: string
  resume?: string
  jd?: string
  questions?: string
}

export async function aiRoutes(fastify: FastifyInstance) {
  // REST Endpoint for non-streaming completions
  fastify.post('/complete', async (request: FastifyRequest<{ Body: AIRequest }>, reply: FastifyReply) => {
    const { prompt, context, role, resume } = request.body

    if (!ai) {
      return { response: `[Mock Response] Received prompt: ${prompt}\nContext: ${context?.slice(0, 50)}...` }
    }

    try {
      const systemInstruction = `You are a helpful AI assistant. You are helping the user with an interview for the role: ${role || 'Not specified'}.\nThe user's resume is:\n${resume || 'Not specified'}.\n\nAnswer concisely based on the transcript context provided in the prompt.`
      const content = `Context: ${context || 'None'}\n\nPrompt: ${prompt}`

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: content,
        config: { systemInstruction }
      })

      return { response: response.text }
    } catch (err: any) {
      fastify.log.error(err)
      return reply.status(500).send({ error: err.message })
    }
  })

  // WebSocket Endpoint for streaming completions
  fastify.get('/stream', { websocket: true }, (connection: any, req: FastifyRequest) => {
    connection.on('message', async (message: Buffer) => {
      try {
        const data: AIRequest = JSON.parse(message.toString())
        const { prompt, context, role, resume, jd, questions } = data as any

        if (!ai) {
          // Mock Streaming
          const mockWords = `[Mock Stream] Gemini API key not found. Simulated response for role "${role}" and prompt "${prompt}".`.split(' ')
          
          for (const word of mockWords) {
            connection.send(JSON.stringify({ chunk: word + ' ' }))
            await new Promise(r => setTimeout(r, 100))
          }
          connection.send(JSON.stringify({ done: true }))
          return
        }

        const systemInstruction = `You are an expert AI assistant secretly helping the user during an interview. Keep your answers extremely concise, bulleted, and directly to the point so they can be read quickly. Do not output pleasantries or filler words.
Role/Interview Context: ${role || 'Not specified'}

User's Resume Context:
${resume || 'Not specified'}

Job Description (JD) Context:
${jd || 'Not provided'}

Expected / Prepared Questions & Answers:
${questions || 'Not provided'}

Align your guidance with the Job Description and leverage the User's Resume and Prepared Questions where applicable.`
        const content = `Recent Transcript Context:\n${context || 'None'}\n\nUser Question/Prompt: ${prompt}`

        const stream = await ai.models.generateContentStream({
          model: 'gemini-2.5-flash',
          contents: content,
          config: { systemInstruction }
        })

        for await (const chunk of stream) {
          if (chunk.text) {
            connection.send(JSON.stringify({ chunk: chunk.text }))
          }
        }
        
        connection.send(JSON.stringify({ done: true }))

      } catch (err: any) {
        fastify.log.error(err)
        connection.send(JSON.stringify({ error: err.message }))
      }
    })
  })
}
