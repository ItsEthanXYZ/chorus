import { OpenAIEmbeddings } from "@langchain/openai";
import { env } from "../env";

const embeddings = new OpenAIEmbeddings({
  model: "text-embedding-3-small",
  apiKey: env.OPEN_AI_API_KEY,
});

export async function embedQuery(text: string) {
  return await embeddings.embedQuery(text);
}

export async function embedDocuments(texts: string[]) {
  return await embeddings.embedDocuments(texts);
}
