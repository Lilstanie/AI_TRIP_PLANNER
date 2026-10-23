export interface RecognizedMemory {
  key: "dietary" | "pace" | "interests" | "accessibility" | "accommodation" | "departure_city";
  value: string;
}

export function recognizeAccountMemory(message: string): RecognizedMemory | undefined;
