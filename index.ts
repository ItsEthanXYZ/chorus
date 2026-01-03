import { OpenAIEmbeddings } from "@langchain/openai";

const EMBEDDING_URL = "http://127.0.0.1:8080/v1";

const embeddings = new OpenAIEmbeddings({
  model: "qwen3-embedding",
  configuration: {
    baseURL: EMBEDDING_URL,
  },
  apiKey: "dummy",
});

const texts = ["LangChain is a framework", "It helps build AI apps"];
const vectors = await embeddings.embedDocuments(texts);
console.log(vectors);

