import { createContext, useContext, useState, useEffect } from 'react';

interface DesignerContextType {
  isEditMode: boolean;
  toggleEditMode: () => void;
  branding: {
    primaryColor: string;
    borderRadius: number;
    glassOpacity: number;
  };
  updateBranding: (updates: Partial<DesignerContextType['branding']>) => void;
}

const DesignerContext = createContext<DesignerContextType | undefined>(undefined);

export const DesignerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [branding, setBranding] = useState({
    primaryColor: '#60cdff',
    borderRadius: 8,
    glassOpacity: 0.6,
  });

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('sport_designer_state');
    if (saved) {
      try {
        setBranding(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load branding', e);
      }
    }
  }, []);

  const toggleEditMode = () => setIsEditMode(!isEditMode);

  const updateBranding = (updates: Partial<DesignerContextType['branding']>) => {
    const newBranding = { ...branding, ...updates };
    setBranding(newBranding);
    localStorage.setItem('sport_designer_state', JSON.stringify(newBranding));
    
    // Apply to CSS variables
    document.documentElement.style.setProperty('--color-win-accent-dark', newBranding.primaryColor);
    document.documentElement.style.setProperty('--mantine-radius-default', `${newBranding.borderRadius}px`);
  };

  return (
    <DesignerContext.Provider value={{ isEditMode, toggleEditMode, branding, updateBranding }}>
      {children}
    </DesignerContext.Provider>
  );
};

export const useDesigner = () => {
  const context = useContext(DesignerContext);
  if (!context) throw new Error('useDesigner must be used within DesignerProvider');
  return context;
};

export const EditableText: React.FC<{ 
  initialValue: string; 
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  weight?: number;
  className?: string;
}> = ({ initialValue, size = 'md', weight = 400, className }) => {
  const { isEditMode } = useDesigner();
  const [text, setText] = useState(initialValue);

  return (
    <div 
      contentEditable={isEditMode}
      onBlur={(e) => setText(e.currentTarget.textContent || '')}
      style={{ 
        outline: isEditMode ? '1px dashed var(--color-win-accent-dark)' : 'none',
        padding: isEditMode ? '2px' : '0',
        display: 'inline-block',
        minWidth: '20px',
        fontWeight: weight,
        fontSize: `var(--mantine-font-size-${size})`
      }}
      className={className}
      suppressContentEditableWarning
    >
      {text}
    </div>
  );
};
