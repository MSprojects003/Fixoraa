// src/types/css.d.ts
declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}

// For react-phone-input-2 specific CSS
declare module 'react-phone-input-2/lib/style.css' {
  const content: any;
  export default content;
}