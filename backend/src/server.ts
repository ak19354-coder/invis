import fastify from 'fastify'
import cors from '@fastify/cors'
import fastifyWebsocket from '@fastify/websocket'
import dotenv from 'dotenv'
import { aiRoutes } from './routes/ai.js'

dotenv.config()

const server = fastify({ logger: true })

server.register(cors, {
  origin: '*', // Allow all origins for the desktop app
})

server.register(fastifyWebsocket, {
  options: { maxPayload: 1048576 } // 1MB
})

server.register(async function (fastify) {
  fastify.register(aiRoutes, { prefix: '/api/v1/ai' })
})

const start = async () => {
  try {
    const port = process.env.PORT ? parseInt(process.env.PORT) : 3001
    await server.listen({ port, host: '0.0.0.0' })
    console.log(`Server listening on port ${port}`)
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

start()
