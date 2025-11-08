"""
Vector Store Module

Provides Weaviate integration for storing and retrieving document embeddings.
"""

import logging
from typing import List, Dict, Any, Optional
import weaviate
from weaviate.classes.query import MetadataQuery
import os

logger = logging.getLogger(__name__)


class VectorStore:
    """
    Manages vector storage and retrieval using Weaviate.

    Supports storing documents with embeddings and performing similarity searches.
    """

    def __init__(self, host: Optional[str] = None, port: Optional[int] = None):
        """
        Initialize Weaviate client.

        Args:
            host: Weaviate host (defaults to env WEAVIATE_HOST or localhost)
            port: Weaviate port (defaults to env WEAVIATE_PORT or 8080)
        """
        self.host = host or os.getenv('WEAVIATE_HOST', 'localhost')
        self.port = port or int(os.getenv('WEAVIATE_PORT', 8080))
        self.url = f"http://{self.host}:{self.port}"
        self.client = None
        self.collection_name = "DxshDocuments"

    async def connect(self):
        """Establish connection to Weaviate."""
        try:
            self.client = weaviate.connect_to_local(
                host=self.host,
                port=self.port
            )
            logger.info(f"Connected to Weaviate at {self.url}")
            await self._ensure_schema()
        except Exception as e:
            logger.error(f"Failed to connect to Weaviate: {e}")
            raise

    async def _ensure_schema(self):
        """Ensure the required schema exists in Weaviate."""
        try:
            # Check if collection exists
            if not self.client.collections.exists(self.collection_name):
                # Create collection with properties
                self.client.collections.create(
                    name=self.collection_name,
                    properties=[
                        {
                            "name": "content",
                            "dataType": ["text"],
                            "description": "Document content"
                        },
                        {
                            "name": "metadata",
                            "dataType": ["text"],
                            "description": "Document metadata as JSON string"
                        },
                        {
                            "name": "source",
                            "dataType": ["text"],
                            "description": "Document source file"
                        },
                        {
                            "name": "chunk_index",
                            "dataType": ["int"],
                            "description": "Chunk index in document"
                        },
                        {
                            "name": "user_id",
                            "dataType": ["int"],
                            "description": "User ID who owns the document"
                        }
                    ],
                    vectorizer_config=weaviate.classes.config.Configure.Vectorizer.none()
                )
                logger.info(f"Created Weaviate collection: {self.collection_name}")
        except Exception as e:
            logger.error(f"Failed to ensure schema: {e}")
            raise

    async def add_documents(
        self,
        documents: List[Dict[str, Any]],
        embeddings: List[List[float]],
        user_id: int
    ) -> List[str]:
        """
        Add documents with embeddings to vector store.

        Args:
            documents: List of document dicts with 'content', 'metadata', 'source'
            embeddings: List of embedding vectors
            user_id: User ID who owns the documents

        Returns:
            List of document IDs
        """
        try:
            if len(documents) != len(embeddings):
                raise ValueError("Number of documents must match number of embeddings")

            collection = self.client.collections.get(self.collection_name)
            document_ids = []

            # Batch insert documents
            with collection.batch.dynamic() as batch:
                for i, (doc, embedding) in enumerate(zip(documents, embeddings)):
                    properties = {
                        "content": doc.get('content', ''),
                        "metadata": str(doc.get('metadata', {})),
                        "source": doc.get('source', ''),
                        "chunk_index": doc.get('chunk_index', i),
                        "user_id": user_id
                    }

                    uuid = batch.add_object(
                        properties=properties,
                        vector=embedding
                    )
                    document_ids.append(str(uuid))

            logger.info(f"Added {len(document_ids)} documents to vector store")
            return document_ids

        except Exception as e:
            logger.error(f"Failed to add documents: {e}")
            raise

    async def search(
        self,
        query_embedding: List[float],
        user_id: int,
        limit: int = 5,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        Search for similar documents using vector similarity.

        Args:
            query_embedding: Query embedding vector
            user_id: User ID to filter results
            limit: Maximum number of results
            filters: Optional additional filters

        Returns:
            List of similar documents with scores
        """
        try:
            collection = self.client.collections.get(self.collection_name)

            # Build filter for user_id
            where_filter = {
                "path": ["user_id"],
                "operator": "Equal",
                "valueInt": user_id
            }

            # Apply additional filters if provided
            if filters:
                where_filter = {
                    "operator": "And",
                    "operands": [where_filter]
                }
                for key, value in filters.items():
                    where_filter["operands"].append({
                        "path": [key],
                        "operator": "Equal",
                        "valueText": str(value)
                    })

            # Perform vector search
            response = collection.query.near_vector(
                near_vector=query_embedding,
                limit=limit,
                return_metadata=MetadataQuery(distance=True),
                where=where_filter
            )

            results = []
            for obj in response.objects:
                results.append({
                    'id': str(obj.uuid),
                    'content': obj.properties.get('content', ''),
                    'metadata': obj.properties.get('metadata', ''),
                    'source': obj.properties.get('source', ''),
                    'chunk_index': obj.properties.get('chunk_index', 0),
                    'distance': obj.metadata.distance if obj.metadata else None
                })

            logger.info(f"Found {len(results)} similar documents")
            return results

        except Exception as e:
            logger.error(f"Failed to search documents: {e}")
            raise

    async def delete_documents(self, document_ids: List[str]) -> bool:
        """
        Delete documents by IDs.

        Args:
            document_ids: List of document IDs to delete

        Returns:
            True if successful
        """
        try:
            collection = self.client.collections.get(self.collection_name)

            for doc_id in document_ids:
                collection.data.delete_by_id(doc_id)

            logger.info(f"Deleted {len(document_ids)} documents")
            return True

        except Exception as e:
            logger.error(f"Failed to delete documents: {e}")
            raise

    async def delete_by_source(self, source: str, user_id: int) -> int:
        """
        Delete all documents from a specific source.

        Args:
            source: Source file path
            user_id: User ID who owns the documents

        Returns:
            Number of documents deleted
        """
        try:
            collection = self.client.collections.get(self.collection_name)

            # Delete by source and user_id
            result = collection.data.delete_many(
                where={
                    "operator": "And",
                    "operands": [
                        {
                            "path": ["source"],
                            "operator": "Equal",
                            "valueText": source
                        },
                        {
                            "path": ["user_id"],
                            "operator": "Equal",
                            "valueInt": user_id
                        }
                    ]
                }
            )

            count = result.successful if hasattr(result, 'successful') else 0
            logger.info(f"Deleted {count} documents from source: {source}")
            return count

        except Exception as e:
            logger.error(f"Failed to delete documents by source: {e}")
            raise

    async def close(self):
        """Close Weaviate connection."""
        if self.client:
            self.client.close()
            logger.info("Closed Weaviate connection")
