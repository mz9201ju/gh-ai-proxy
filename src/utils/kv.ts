/**
 * 💾 UTF-8 safe JSON storage for KV.
 * Prevents emoji or multilingual text corruption.
 */
export async function putJsonUtf8(kv: KVNamespace, key: string, obj: any) {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(JSON.stringify(obj));
    await kv.put(key, bytes);
}

/**
 * 📖 UTF-8 safe JSON retrieval from KV.
 */
export async function getJsonUtf8<T>(kv: KVNamespace, key: string): Promise<T | null> {
    const raw = await kv.get(key, "arrayBuffer");
    if (!raw) return null;
    const decoder = new TextDecoder("utf-8");
    return JSON.parse(decoder.decode(raw));
}
