import { type KeyboardEvent, useLayoutEffect, useRef } from "react";

interface Props {
  className?: string;
  maxHeight?: number;
  minHeight?: number;
  onChange: (value: string) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  value: string;
}

const DEFAULT_MIN_HEIGHT = 78;
const DEFAULT_MAX_HEIGHT = 180;

export function AutoResizeTextarea({
  className,
  maxHeight = DEFAULT_MAX_HEIGHT,
  minHeight = DEFAULT_MIN_HEIGHT,
  onChange,
  onKeyDown,
  placeholder,
  value
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = `${minHeight}px`;
    const nextHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [maxHeight, minHeight, value]);

  return (
    <textarea
      className={className}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      ref={textareaRef}
      rows={1}
      value={value}
    />
  );
}
