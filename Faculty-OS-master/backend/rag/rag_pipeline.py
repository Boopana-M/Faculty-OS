import os
import uuid
from typing import List, Dict, Any

# We will initialize ChromaDB and SentenceTransformers.
# Let's wrap imports in try-except to guarantee the server can start even if torch is still downloading.
try:
    import chromadb
    from chromadb.utils import embedding_functions
    CHROMA_AVAILABLE = True
except ImportError:
    CHROMA_AVAILABLE = False

CHROMA_DB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "chroma_data")

class RAGPipeline:
    def __init__(self):
        self.client = None
        self.collection = None
        self.initialized = False
        
        if not CHROMA_AVAILABLE:
            print("Warning: chromadb or embedding_functions not available. RAG will run in fallback mode.")
            return

        try:
            # Create persistent client
            self.client = chromadb.PersistentClient(path=CHROMA_DB_DIR)
            
            # Use local sentence transformers for embedding
            # Note: chroma will download this model on first run if not cached
            self.emb_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
                model_name="all-MiniLM-L6-v2"
            )
            
            self.collection = self.client.get_or_create_collection(
                name="policy_documents", 
                embedding_function=self.emb_fn
            )
            self.initialized = True
            print("ChromaDB RAG Pipeline successfully initialized.")
        except Exception as e:
            print(f"Error initializing ChromaDB: {e}. Falling back to in-memory dictionary-based search.")
            self.initialized = False

        # In-memory backup database for policies if Chroma fails or is not available
        self.backup_docs = []

    def chunk_text(self, text: str, chunk_size: int = 500, overlap: int = 50) -> List[str]:
        words = text.split()
        chunks = []
        i = 0
        while i < len(words):
            chunk = " ".join(words[i:i + chunk_size])
            chunks.append(chunk)
            i += (chunk_size - overlap)
        return chunks

    def ingest_document(self, title: str, text: str, category: str, source_name: str):
        """
        Split a document into chunks and add to the vector store.
        """
        chunks = self.chunk_text(text)
        
        # Always add to backup just in case
        for i, chunk in enumerate(chunks):
            self.backup_docs.append({
                "id": f"{source_name}_chunk_{i}",
                "text": chunk,
                "metadata": {
                    "title": title,
                    "category": category,
                    "source": source_name,
                    "chunk_index": i
                }
            })

        if not self.initialized:
            print(f"ChromaDB not initialized, ingested '{title}' to backup storage only.")
            return

        try:
            ids = [f"{source_name}_{uuid.uuid4().hex[:8]}_{i}" for i in range(len(chunks))]
            metadatas = [{
                "title": title,
                "category": category,
                "source": source_name,
                "chunk_index": i
            } for i in range(len(chunks))]
            
            self.collection.add(
                documents=chunks,
                metadatas=metadatas,
                ids=ids
            )
            print(f"ChromaDB ingested {len(chunks)} chunks for document: {title}")
        except Exception as e:
            print(f"Failed to ingest document '{title}' in Chroma: {e}")

    def query(self, query_text: str, n_results: int = 3) -> List[Dict[str, Any]]:
        """
        Query the RAG pipeline. Returns a list of dicts with keys: document, metadata, score.
        """
        if self.initialized:
            try:
                results = self.collection.query(
                    query_texts=[query_text],
                    n_results=n_results
                )
                
                output = []
                if results and 'documents' in results and results['documents']:
                    documents = results['documents'][0]
                    metadatas = results['metadatas'][0]
                    distances = results['distances'][0] if 'distances' in results else [0.0]*len(documents)
                    
                    for doc, meta, dist in zip(documents, metadatas, distances):
                        # Convert distance to a similarity score (approximate)
                        score = max(0.0, 1.0 - (dist / 2.0))
                        output.append({
                            "text": doc,
                            "metadata": meta,
                            "score": score
                        })
                return output
            except Exception as e:
                print(f"ChromaDB query error: {e}. Falling back to backup query.")
        
        # Fallback simple keyword / substring relevance matching
        print("Using fallback RAG query matching...")
        query_words = set(query_text.lower().split())
        scored_docs = []
        for doc in self.backup_docs:
            text = doc["text"].lower()
            # Calculate simple word overlap score
            match_count = sum(1 for word in query_words if word in text)
            if match_count > 0:
                score = match_count / len(query_words)
                scored_docs.append({
                    "text": doc["text"],
                    "metadata": doc["metadata"],
                    "score": score
                })
        
        # Sort by score descending
        scored_docs.sort(key=lambda x: x["score"], reverse=True)
        return scored_docs[:n_results]

# Single global instance
rag_pipeline = RAGPipeline()
