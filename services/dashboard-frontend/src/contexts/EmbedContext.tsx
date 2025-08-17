/**
 * Embed Context
 * 
 * Provides embed token to child components for authenticated embed access
 */

import React, { createContext, useContext } from 'react';

interface EmbedContextValue {
  token: string | null;
}

export const EmbedContext = createContext<EmbedContextValue>({ token: null });

export const useEmbedToken = () => {
  const context = useContext(EmbedContext);
  return context.token;
};

export const EmbedProvider: React.FC<{ token: string | null; children: React.ReactNode }> = ({ token, children }) => {
  return (
    <EmbedContext.Provider value={{ token }}>
      {children}
    </EmbedContext.Provider>
  );
};