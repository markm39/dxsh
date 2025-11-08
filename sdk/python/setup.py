"""
Dxsh SDK Setup

Setup script for publishing to PyPI.
"""

from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="dxsh-sdk",
    version="1.0.0",
    author="Dxsh Team",
    author_email="support@dxsh.io",
    description="Python SDK for creating custom Dxsh workflow nodes",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/dxsh/dxsh-sdk",
    packages=find_packages(),
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "Topic :: Software Development :: Libraries :: Python Modules",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
    ],
    python_requires=">=3.8",
    install_requires=[
        "typing-extensions>=4.0.0",
    ],
    extras_require={
        "dev": [
            "pytest>=7.0.0",
            "pytest-asyncio>=0.21.0",
            "black>=23.0.0",
            "mypy>=1.0.0",
        ],
    },
    keywords="dxsh workflow automation nodes sdk",
    project_urls={
        "Documentation": "https://docs.dxsh.io/sdk",
        "Source": "https://github.com/dxsh/dxsh-sdk",
        "Tracker": "https://github.com/dxsh/dxsh-sdk/issues",
    },
)
