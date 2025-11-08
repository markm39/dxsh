"""
Embedding Service Module

Generates embeddings for documents and queries using sentence-transformers.
"""

import logging
from typing import List, Optional, Dict, Any
import asyncio
from functools import lru_cache
import numpy as np

logger = logging.getLogger(__name__)


class EmbeddingService:
    """
    Generates embeddings using sentence-transformers models.

    Supports batching and caching for efficient embedding generation.
    """

    def __init__(
        self,
        model_name: str = "all-MiniLM-L6-v2",
        device: Optional[str] = None,
        batch_size: int = 32
    ):
        """
        Initialize embedding service.

        Args:
            model_name: Name of the sentence-transformers model
            device: Device to run model on ('cpu', 'cuda', or None for auto)
            batch_size: Batch size for embedding generation
        """
        self.model_name = model_name
        self.device = device
        self.batch_size = batch_size
        self.model = None
        self._initialized = False

    async def initialize(self):
        """Load the embedding model."""
        if self._initialized:
            return

        try:
            from sentence_transformers import SentenceTransformer

            logger.info(f"Loading embedding model: {self.model_name}")

            # Run model loading in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            self.model = await loop.run_in_executor(
                None,
                lambda: SentenceTransformer(self.model_name, device=self.device)
            )

            self._initialized = True
            logger.info(f"Embedding model loaded: {self.model_name}")

        except ImportError:
            raise ImportError(
                "sentence-transformers not installed. "
                "Install with: pip install sentence-transformers"
            )
        except Exception as e:
            logger.error(f"Failed to load embedding model: {e}")
            raise

    async def embed_documents(
        self,
        documents: List[str],
        show_progress: bool = False
    ) -> List[List[float]]:
        """
        Generate embeddings for a list of documents.

        Args:
            documents: List of document texts
            show_progress: Whether to show progress bar

        Returns:
            List of embedding vectors
        """
        if not self._initialized:
            await self.initialize()

        try:
            if not documents:
                return []

            logger.info(f"Generating embeddings for {len(documents)} documents")

            # Run embedding in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            embeddings = await loop.run_in_executor(
                None,
                lambda: self.model.encode(
                    documents,
                    batch_size=self.batch_size,
                    show_progress_bar=show_progress,
                    convert_to_numpy=True
                )
            )

            # Convert to list of lists
            embeddings_list = embeddings.tolist()

            logger.info(f"Generated {len(embeddings_list)} embeddings")
            return embeddings_list

        except Exception as e:
            logger.error(f"Failed to generate embeddings: {e}")
            raise

    async def embed_query(self, query: str) -> List[float]:
        """
        Generate embedding for a single query.

        Args:
            query: Query text

        Returns:
            Embedding vector
        """
        if not self._initialized:
            await self.initialize()

        try:
            logger.debug(f"Generating embedding for query: {query[:100]}...")

            # Run embedding in thread pool
            loop = asyncio.get_event_loop()
            embedding = await loop.run_in_executor(
                None,
                lambda: self.model.encode(
                    [query],
                    convert_to_numpy=True
                )
            )

            return embedding[0].tolist()

        except Exception as e:
            logger.error(f"Failed to generate query embedding: {e}")
            raise

    async def embed_batch(
        self,
        texts: List[str],
        normalize: bool = True
    ) -> List[List[float]]:
        """
        Generate embeddings with optional normalization.

        Args:
            texts: List of texts to embed
            normalize: Whether to L2-normalize embeddings

        Returns:
            List of embedding vectors
        """
        if not self._initialized:
            await self.initialize()

        try:
            embeddings = await self.embed_documents(texts)

            if normalize:
                embeddings = self._normalize_embeddings(embeddings)

            return embeddings

        except Exception as e:
            logger.error(f"Failed to generate batch embeddings: {e}")
            raise

    def _normalize_embeddings(
        self,
        embeddings: List[List[float]]
    ) -> List[List[float]]:
        """
        L2-normalize embeddings.

        Args:
            embeddings: List of embedding vectors

        Returns:
            Normalized embedding vectors
        """
        embeddings_array = np.array(embeddings)
        norms = np.linalg.norm(embeddings_array, axis=1, keepdims=True)
        normalized = embeddings_array / norms
        return normalized.tolist()

    async def compute_similarity(
        self,
        embedding1: List[float],
        embedding2: List[float]
    ) -> float:
        """
        Compute cosine similarity between two embeddings.

        Args:
            embedding1: First embedding vector
            embedding2: Second embedding vector

        Returns:
            Cosine similarity score (0 to 1)
        """
        try:
            vec1 = np.array(embedding1)
            vec2 = np.array(embedding2)

            # Compute cosine similarity
            similarity = np.dot(vec1, vec2) / (
                np.linalg.norm(vec1) * np.linalg.norm(vec2)
            )

            return float(similarity)

        except Exception as e:
            logger.error(f"Failed to compute similarity: {e}")
            raise

    async def compute_similarities(
        self,
        query_embedding: List[float],
        document_embeddings: List[List[float]]
    ) -> List[float]:
        """
        Compute similarities between query and multiple documents.

        Args:
            query_embedding: Query embedding vector
            document_embeddings: List of document embedding vectors

        Returns:
            List of similarity scores
        """
        try:
            query_vec = np.array(query_embedding)
            doc_matrix = np.array(document_embeddings)

            # Normalize vectors
            query_norm = query_vec / np.linalg.norm(query_vec)
            doc_norms = doc_matrix / np.linalg.norm(doc_matrix, axis=1, keepdims=True)

            # Compute dot products (cosine similarities)
            similarities = np.dot(doc_norms, query_norm)

            return similarities.tolist()

        except Exception as e:
            logger.error(f"Failed to compute similarities: {e}")
            raise

    def get_embedding_dimension(self) -> int:
        """
        Get the dimension of embeddings produced by this model.

        Returns:
            Embedding dimension
        """
        if not self._initialized:
            raise RuntimeError("Model not initialized. Call initialize() first.")

        return self.model.get_sentence_embedding_dimension()

    async def batch_embed_with_metadata(
        self,
        documents: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Embed documents and attach metadata.

        Args:
            documents: List of document dicts with 'content' and optional metadata

        Returns:
            List of documents with 'embedding' field added
        """
        try:
            # Extract content for embedding
            texts = [doc['content'] for doc in documents]

            # Generate embeddings
            embeddings = await self.embed_documents(texts)

            # Attach embeddings to documents
            result = []
            for doc, embedding in zip(documents, embeddings):
                doc_with_embedding = {
                    **doc,
                    'embedding': embedding
                }
                result.append(doc_with_embedding)

            return result

        except Exception as e:
            logger.error(f"Failed to batch embed with metadata: {e}")
            raise

    def get_model_info(self) -> Dict[str, Any]:
        """
        Get information about the loaded model.

        Returns:
            Model information dict
        """
        if not self._initialized:
            return {
                'initialized': False,
                'model_name': self.model_name
            }

        return {
            'initialized': True,
            'model_name': self.model_name,
            'embedding_dimension': self.get_embedding_dimension(),
            'device': str(self.model.device),
            'max_seq_length': self.model.max_seq_length
        }
