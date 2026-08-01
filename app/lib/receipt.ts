// GPT-4o structured receipt extraction.
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type ParsedReceipt = {
  orderId: string;
  productName: string;
  productUrl: string | null;
  purchasePrice: number;
  purchaseDate: string; // ISO date
  retailer: string;
  returnDeadline: string | null; // ISO date
  confidence: Record<string, number>;
};

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    orderId: { type: "string" },
    productName: { type: "string" },
    productUrl: { type: ["string", "null"] },
    purchasePrice: { type: "number" },
    purchaseDate: { type: "string" },
    retailer: { type: "string" },
    returnDeadline: { type: ["string", "null"] },
    confidence: {
      type: "object",
      additionalProperties: false,
      properties: {
        orderId: { type: "number" },
        productName: { type: "number" },
        purchasePrice: { type: "number" },
        purchaseDate: { type: "number" },
        returnDeadline: { type: "number" },
      },
      required: ["orderId", "productName", "purchasePrice", "purchaseDate", "returnDeadline"],
    },
  },
  required: [
    "orderId", "productName", "productUrl", "purchasePrice",
    "purchaseDate", "retailer", "returnDeadline", "confidence",
  ],
} as const;

export async function parseReceipt(input: { text?: string; imageDataUrl?: string }): Promise<ParsedReceipt> {
  const content: OpenAI.Chat.ChatCompletionContentPart[] = [];
  content.push({
    type: "text",
    text:
      "Extract the order details from this retail purchase receipt/confirmation. " +
      "Dates as ISO YYYY-MM-DD. If the return deadline is not stated, return null for it. " +
      "confidence values are 0-1 per field." +
      (input.text ? `\n\nRECEIPT TEXT:\n${input.text}` : ""),
  });
  if (input.imageDataUrl) {
    content.push({ type: "image_url", image_url: { url: input.imageDataUrl } });
  }
  const res = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content }],
    response_format: {
      type: "json_schema",
      json_schema: { name: "receipt", strict: true, schema: schema as unknown as Record<string, unknown> },
    },
  });
  return JSON.parse(res.choices[0].message.content!) as ParsedReceipt;
}
