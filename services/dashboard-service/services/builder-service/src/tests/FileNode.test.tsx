import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import FileNode from '../components/workflow-builder/nodes/FileNode';
import FileNodeSetup from '../components/node-configs/FileNodeSetup';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock useAuth hook
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    authHeaders: { 'Authorization': 'Bearer test-token' }
  })
}));

// Mock environment variable
vi.mock('../config', () => ({
  API_BASE_URL: 'http://localhost:5000'
}));

describe('FileNode', () => {
  const defaultProps = {
    data: {
      id: 'test-file-node',
      label: 'Test File Node',
      configured: true,
      isExecuting: false,
      executionResult: null,
      fileConfig: {
        operationMode: 'source' as const,
        fileName: 'test.csv',
        filePath: '/path/to/test.csv',
        fileType: 'csv'
      }
    }
  };

  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Delete Functionality', () => {
    it('should call onDelete when delete button is clicked', async () => {
      const mockOnDelete = vi.fn();
      
      render(
        <FileNode 
          {...defaultProps} 
          onDelete={mockOnDelete}
        />
      );

      // Find and click the delete button
      const deleteButton = screen.getByTitle('Delete this node');
      expect(deleteButton).toBeInTheDocument();

      fireEvent.click(deleteButton);

      // Verify onDelete was called
      expect(mockOnDelete).toHaveBeenCalledTimes(1);
    });

    it('should disable delete button when node is executing', () => {
      const mockOnDelete = vi.fn();
      
      render(
        <FileNode 
          {...defaultProps} 
          data={{
            ...defaultProps.data,
            isExecuting: true
          }}
          onDelete={mockOnDelete}
        />
      );

      const deleteButton = screen.getByTitle('Delete this node');
      expect(deleteButton).toBeDisabled();
    });

    it('should not render delete button when onDelete is not provided', () => {
      render(<FileNode {...defaultProps} />);
      
      const deleteButton = screen.queryByTitle('Delete this node');
      expect(deleteButton).not.toBeInTheDocument();
    });
  });

  describe('Run From Here Functionality', () => {
    it('should call onRunFromHere when run button is clicked', () => {
      const mockOnRunFromHere = vi.fn();
      
      render(
        <FileNode 
          {...defaultProps} 
          onRunFromHere={mockOnRunFromHere}
        />
      );

      const runButton = screen.getByTitle(/Run workflow from this node/);
      fireEvent.click(runButton);

      expect(mockOnRunFromHere).toHaveBeenCalledTimes(1);
    });
  });
});

describe('FileNodeSetup', () => {
  const defaultSetupProps = {
    onClose: vi.fn(),
    onSave: vi.fn(),
    inputData: [],
    isConfigured: false,
    inputVariables: []
  };

  beforeEach(() => {
    mockFetch.mockClear();
    // Mock successful responses by default
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: [] }),
      text: () => Promise.resolve('Success')
    });
  });

  describe('File Upload and Testing', () => {
    it('should prevent testing before file upload for source mode', async () => {
      render(<FileNodeSetup {...defaultSetupProps} />);

      // Select source mode (should be default)
      const testButton = screen.getByText('Test');
      
      // Try to test without uploading file
      fireEvent.click(testButton);

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/Please upload the file first before testing/)).toBeInTheDocument();
      });

      // Fetch should not be called
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should make proper API call with correct payload for source mode', async () => {
      const mockConfig = {
        operationMode: 'source' as const,
        filePath: '/uploaded/test.csv',
        fileName: 'test.csv',
        fileType: 'csv',
        hasHeaders: true,
        delimiter: ','
      };

      render(
        <FileNodeSetup 
          {...defaultSetupProps} 
          initialConfig={mockConfig}
        />
      );

      const testButton = screen.getByText('Test');
      fireEvent.click(testButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:5000/api/v1/file-node/load',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
              'Authorization': 'Bearer test-token'
            }),
            body: expect.stringContaining('"operationMode":"source"')
          })
        );
      });

      // Parse the sent body to verify structure
      const callArgs = mockFetch.mock.calls[0];
      const sentBody = JSON.parse(callArgs[1].body);
      
      expect(sentBody).toMatchObject({
        operationMode: 'source',
        filePath: '/uploaded/test.csv',
        fileName: 'test.csv',
        fileType: 'csv',
        hasHeaders: true,
        delimiter: ',',
        encoding: 'utf-8',
        maxRows: 100,
        skipRows: 0
      });
    });

    it('should handle API errors gracefully', async () => {
      // Mock API error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Bad Request: Missing required field')
      });

      const mockConfig = {
        operationMode: 'source' as const,
        filePath: '/uploaded/test.csv',
        fileName: 'test.csv',
        fileType: 'csv'
      };

      render(
        <FileNodeSetup 
          {...defaultSetupProps} 
          initialConfig={mockConfig}
        />
      );

      const testButton = screen.getByText('Test');
      fireEvent.click(testButton);

      await waitFor(() => {
        expect(screen.getByText(/Test failed \(400\): Bad Request: Missing required field/)).toBeInTheDocument();
      });
    });
  });

  describe('Sink Mode Testing', () => {
    const inputData = [
      { name: 'John', age: 30, city: 'New York' },
      { name: 'Jane', age: 25, city: 'Los Angeles' }
    ];

    it('should make proper API call for sink mode with input data', async () => {
      const mockConfig = {
        operationMode: 'sink' as const,
        outputFileName: 'output.csv',
        outputPath: '/output/'
      };

      render(
        <FileNodeSetup 
          {...defaultSetupProps} 
          initialConfig={mockConfig}
          inputData={inputData}
        />
      );

      const testButton = screen.getByText('Test');
      fireEvent.click(testButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:5000/api/v1/file-node/save',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Content-Type': 'application/json'
            }),
            body: expect.stringContaining('"operationMode":"sink"')
          })
        );
      });

      const callArgs = mockFetch.mock.calls[0];
      const sentBody = JSON.parse(callArgs[1].body);
      
      expect(sentBody).toMatchObject({
        operationMode: 'sink',
        outputFileName: 'output.csv',
        outputPath: '/output/',
        inputData: inputData.slice(0, 10) // Should limit to 10 records for testing
      });
    });

    it('should prevent testing sink mode without input data', async () => {
      render(
        <FileNodeSetup 
          {...defaultSetupProps} 
          initialConfig={{ operationMode: 'sink' as const }}
          inputData={[]}
        />
      );

      const testButton = screen.getByText('Test');
      fireEvent.click(testButton);

      await waitFor(() => {
        expect(screen.getByText(/No input data available for testing/)).toBeInTheDocument();
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('File Preview Functionality', () => {
    it('should make preview API call and show data types', async () => {
      const previewData = [
        { name: 'John', age: 30, active: true },
        { name: 'Jane', age: 25, active: false }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: previewData })
      });

      const mockConfig = {
        operationMode: 'source' as const,
        filePath: '/uploaded/test.csv',
        fileName: 'test.csv',
        fileType: 'csv'
      };

      render(
        <FileNodeSetup 
          {...defaultSetupProps} 
          initialConfig={mockConfig}
        />
      );

      const previewButton = screen.getByText('Preview');
      fireEvent.click(previewButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:5000/api/v1/file-node/preview',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('"maxRows":10')
          })
        );
      });

      // Should show preview data
      await waitFor(() => {
        expect(screen.getByText('File Data Preview')).toBeInTheDocument();
        expect(screen.getByText('Detected Fields')).toBeInTheDocument();
        expect(screen.getByText('Sample Data')).toBeInTheDocument();
      });
    });
  });

  describe('Field Selection', () => {
    it('should allow selecting fields for source mode', async () => {
      const previewData = [
        { name: 'John', age: 30, city: 'New York' },
        { name: 'Jane', age: 25, city: 'Los Angeles' }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: previewData })
      });

      const mockConfig = {
        operationMode: 'source' as const,
        filePath: '/uploaded/test.csv',
        fileName: 'test.csv',
        fileType: 'csv'
      };

      render(
        <FileNodeSetup 
          {...defaultSetupProps} 
          initialConfig={mockConfig}
        />
      );

      // First preview the file to get field selection UI
      const previewButton = screen.getByText('Preview');
      fireEvent.click(previewButton);

      await waitFor(() => {
        expect(screen.getByText('Select Fields to Output')).toBeInTheDocument();
      });

      // Click "Select All" button
      const selectAllButton = screen.getByText('Select All');
      fireEvent.click(selectAllButton);

      // Should show selected fields
      await waitFor(() => {
        expect(screen.getByText(/Selected fields \(3\):/)).toBeInTheDocument();
        expect(screen.getByText('name, age, city')).toBeInTheDocument();
      });
    });

    it('should allow selecting fields for sink mode', async () => {
      const inputData = [
        { name: 'John', age: 30, city: 'New York' },
        { name: 'Jane', age: 25, city: 'Los Angeles' }
      ];

      render(
        <FileNodeSetup 
          {...defaultSetupProps} 
          initialConfig={{ operationMode: 'sink' as const }}
          inputData={inputData}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Select Fields to Save')).toBeInTheDocument();
      });

      // Click "Select All" button
      const selectAllButton = screen.getByText('Select All');
      fireEvent.click(selectAllButton);

      // Should show selected fields
      await waitFor(() => {
        expect(screen.getByText(/Selected fields to save \(3\):/)).toBeInTheDocument();
        expect(screen.getByText('name, age, city')).toBeInTheDocument();
      });
    });
  });
});