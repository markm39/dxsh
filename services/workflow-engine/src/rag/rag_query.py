"""
RAG Query Engine Module

Combines retrieval and generation for question-answering over documents.
"""

import logging
from typing import List, Dict, Any, Optional
import os
from openai import AsyncOpenAI

from .vector_store import VectorStore
from .embedding_service import EmbeddingService

logger = logging.getLogger(__name__)


class RAGQueryEngine:
    """
    RAG query engine that retrieves relevant documents and generates answers.

    Combines vector search with LLM generation for accurate question-answering.
    """

    def __init__(
        self,
        vector_store: Optional[VectorStore] = None,
        embedding_service: Optional[EmbeddingService] = None,
        llm_model: str = "gpt-4-turbo-preview",
        top_k: int = 5,
        temperature: float = 0.7
    ):
        """
        Initialize RAG query engine.

        Args:
            vector_store: VectorStore instance (creates new if None)
            embedding_service: EmbeddingService instance (creates new if None)
            llm_model: OpenAI model to use for generation
            top_k: Number of documents to retrieve
            temperature: LLM temperature for generation
        """
        self.vector_store = vector_store or VectorStore()
        self.embedding_service = embedding_service or EmbeddingService()
        self.llm_model = llm_model
        self.top_k = top_k
        self.temperature = temperature
        self.openai_client = None

    async def initialize(self):
        """Initialize all components."""
        try:
            # Initialize vector store
            await self.vector_store.connect()

            # Initialize embedding service
            await self.embedding_service.initialize()

            # Initialize OpenAI client
            api_key = os.getenv('OPENAI_API_KEY')
            if not api_key:
                raise ValueError("OPENAI_API_KEY environment variable not set")

            self.openai_client = AsyncOpenAI(api_key=api_key)

            logger.info("RAG query engine initialized")

        except Exception as e:
            logger.error(f"Failed to initialize RAG query engine: {e}")
            raise

    async def query(
        self,
        question: str,
        user_id: int,
        filters: Optional[Dict[str, Any]] = None,
        return_sources: bool = True
    ) -> Dict[str, Any]:
        """
        Query the RAG system with a question.

        Args:
            question: Question to answer
            user_id: User ID for document access control
            filters: Optional filters for document retrieval
            return_sources: Whether to return source documents

        Returns:
            Dict with 'answer', 'sources', and 'metadata'
        """
        try:
            logger.info(f"Processing RAG query: {question[:100]}...")

            # Generate query embedding
            query_embedding = await self.embedding_service.embed_query(question)

            # Retrieve relevant documents
            retrieved_docs = await self.vector_store.search(
                query_embedding=query_embedding,
                user_id=user_id,
                limit=self.top_k,
                filters=filters
            )

            if not retrieved_docs:
                return {
                    'answer': "I couldn't find any relevant information to answer your question.",
                    'sources': [],
                    'metadata': {
                        'documents_retrieved': 0,
                        'question': question
                    }
                }

            # Generate answer using retrieved documents
            answer = await self._generate_answer(question, retrieved_docs)

            # Prepare response
            response = {
                'answer': answer,
                'metadata': {
                    'documents_retrieved': len(retrieved_docs),
                    'question': question,
                    'model': self.llm_model
                }
            }

            if return_sources:
                response['sources'] = [
                    {
                        'content': doc['content'][:500],
                        'source': doc['source'],
                        'chunk_index': doc['chunk_index'],
                        'relevance_score': 1 - doc['distance'] if doc['distance'] else None
                    }
                    for doc in retrieved_docs
                ]

            logger.info(f"Generated answer with {len(retrieved_docs)} sources")
            return response

        except Exception as e:
            logger.error(f"Failed to process RAG query: {e}")
            raise

    async def _generate_answer(
        self,
        question: str,
        documents: List[Dict[str, Any]]
    ) -> str:
        """
        Generate answer using LLM with retrieved documents.

        Args:
            question: User question
            documents: Retrieved documents

        Returns:
            Generated answer
        """
        try:
            # Build context from retrieved documents
            context_parts = []
            for i, doc in enumerate(documents, 1):
                context_parts.append(
                    f"Document {i} (from {doc['source']}):\n{doc['content']}\n"
                )

            context = "\n".join(context_parts)

            # Build prompt
            system_prompt = (
                "You are a helpful assistant that answers questions based on the provided context. "
                "Use only the information from the context to answer questions. "
                "If the context doesn't contain enough information to answer the question, "
                "say so clearly. Cite the document numbers when possible."
            )

            user_prompt = f"""Context:
{context}

Question: {question}

Please provide a comprehensive answer based on the context above."""

            # Generate answer
            response = await self.openai_client.chat.completions.create(
                model=self.llm_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=self.temperature,
                max_tokens=1000
            )

            answer = response.choices[0].message.content.strip()
            return answer

        except Exception as e:
            logger.error(f"Failed to generate answer: {e}")
            raise

    async def query_with_conversation(
        self,
        question: str,
        user_id: int,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        filters: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Query with conversation history for multi-turn dialogue.

        Args:
            question: Current question
            user_id: User ID for document access
            conversation_history: Previous conversation messages
            filters: Optional document filters

        Returns:
            Dict with 'answer', 'sources', and 'metadata'
        """
        try:
            # Generate query embedding
            query_embedding = await self.embedding_service.embed_query(question)

            # Retrieve relevant documents
            retrieved_docs = await self.vector_store.search(
                query_embedding=query_embedding,
                user_id=user_id,
                limit=self.top_k,
                filters=filters
            )

            if not retrieved_docs:
                return {
                    'answer': "I couldn't find any relevant information to answer your question.",
                    'sources': [],
                    'metadata': {
                        'documents_retrieved': 0,
                        'question': question
                    }
                }

            # Build context
            context_parts = []
            for i, doc in enumerate(retrieved_docs, 1):
                context_parts.append(
                    f"Document {i}:\n{doc['content']}\n"
                )
            context = "\n".join(context_parts)

            # Build messages with conversation history
            messages = [
                {
                    "role": "system",
                    "content": (
                        "You are a helpful assistant that answers questions based on provided context. "
                        "Use the conversation history and context to provide accurate answers."
                    )
                }
            ]

            # Add conversation history
            if conversation_history:
                messages.extend(conversation_history)

            # Add current question with context
            messages.append({
                "role": "user",
                "content": f"Context:\n{context}\n\nQuestion: {question}"
            })

            # Generate answer
            response = await self.openai_client.chat.completions.create(
                model=self.llm_model,
                messages=messages,
                temperature=self.temperature,
                max_tokens=1000
            )

            answer = response.choices[0].message.content.strip()

            return {
                'answer': answer,
                'sources': [
                    {
                        'content': doc['content'][:500],
                        'source': doc['source'],
                        'relevance_score': 1 - doc['distance'] if doc['distance'] else None
                    }
                    for doc in retrieved_docs
                ],
                'metadata': {
                    'documents_retrieved': len(retrieved_docs),
                    'question': question,
                    'model': self.llm_model
                }
            }

        except Exception as e:
            logger.error(f"Failed to process conversational query: {e}")
            raise

    async def hybrid_search(
        self,
        question: str,
        user_id: int,
        keyword_weight: float = 0.5,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        Perform hybrid search combining vector and keyword search.

        Args:
            question: Search query
            user_id: User ID for access control
            keyword_weight: Weight for keyword search (0-1)
            filters: Optional document filters

        Returns:
            List of retrieved documents with scores
        """
        try:
            # Vector search
            query_embedding = await self.embedding_service.embed_query(question)
            vector_results = await self.vector_store.search(
                query_embedding=query_embedding,
                user_id=user_id,
                limit=self.top_k * 2,
                filters=filters
            )

            # Score normalization and combination
            # In a full implementation, you would also do keyword search
            # and combine scores. For now, we just return vector results.
            results = []
            for doc in vector_results:
                vector_score = 1 - doc['distance'] if doc['distance'] else 0
                final_score = vector_score

                results.append({
                    **doc,
                    'score': final_score,
                    'vector_score': vector_score
                })

            # Sort by final score and return top_k
            results.sort(key=lambda x: x['score'], reverse=True)
            return results[:self.top_k]

        except Exception as e:
            logger.error(f"Failed to perform hybrid search: {e}")
            raise

    async def close(self):
        """Close all connections."""
        await self.vector_store.close()
        logger.info("RAG query engine closed")
