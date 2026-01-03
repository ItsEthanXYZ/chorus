import { OpenAIEmbeddings } from "@langchain/openai";
import { env } from "./convex/env";

const embeddings = new OpenAIEmbeddings({
  apiKey: env.OPEN_AI_API_KEY,
  model: "text-embedding-3-small",
});

const texts = ["LangChain is a framework", "It helps build AI apps"];
const vectors = await embeddings.embedDocuments(texts);
console.log(vectors);
