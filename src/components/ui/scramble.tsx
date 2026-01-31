'use client';

import type React from 'react';

import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

type ScrambleHoverProps = {
  text: string;
  scrambleSpeed?: number;
  maxIterations?: number;
  sequential?: boolean;
  revealDirection?: 'start' | 'end' | 'center';
  useOriginalCharsOnly?: boolean;
  characters?: string;
  className?: string;
  scrambledClassName?: string;
  isHovering?: boolean;
  setIsHovering?: (isHovering: boolean) => void;
};

const ScrambleHover: React.FC<ScrambleHoverProps> = ({
  text,
  scrambleSpeed = 50,
  maxIterations = 10,
  useOriginalCharsOnly = false,
  characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!@#$%^&*()_+',
  className,
  scrambledClassName,
  sequential = false,
  revealDirection = 'start',
  isHovering,
  setIsHovering,
  ...props
}) => {
  const [displayText, setDisplayText] = useState(text);
  const [isScrambling, setIsScrambling] = useState(false);
  const revealedIndicesRef = useRef(new Set<number>());

  useEffect(() => {
    let interval: NodeJS.Timeout;
    let currentIteration = 0;

    const availableChars = useOriginalCharsOnly
      ? Array.from(new Set(text.split(''))).filter(char => char !== ' ')
      : characters.split('');

    const getNextIndex = () => {
      const textLength = text.length;
      let middle: number;
      let offset: number;
      let nextIndex: number;

      switch (revealDirection) {
        case 'start':
          return revealedIndicesRef.current.size;
        case 'end':
          return textLength - 1 - revealedIndicesRef.current.size;
        case 'center':
          middle = Math.floor(textLength / 2);
          offset = Math.floor(revealedIndicesRef.current.size / 2);
          nextIndex = revealedIndicesRef.current.size % 2 === 0 ? middle + offset : middle - offset - 1;

          if (nextIndex >= 0 && nextIndex < textLength && !revealedIndicesRef.current.has(nextIndex)) {
            return nextIndex;
          }

          for (let i = 0; i < textLength; i++) {
            if (!revealedIndicesRef.current.has(i)) {
              return i;
            }
          }
          return 0;
        default:
          return revealedIndicesRef.current.size;
      }
    };

    const shuffleText = (text: string) => {
      if (useOriginalCharsOnly) {
        const positions = text.split('').map((char, i) => ({
          char,
          isSpace: char === ' ',
          index: i,
          isRevealed: revealedIndicesRef.current.has(i),
        }));

        const nonSpaceChars = positions.filter(p => !p.isSpace && !p.isRevealed).map(p => p.char);

        // Shuffle remaining non-revealed, non-space characters
        for (let i = nonSpaceChars.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          const temp = nonSpaceChars[i];
          nonSpaceChars[i] = nonSpaceChars[j]!;
          nonSpaceChars[j] = temp!;
        }

        let charIndex = 0;
        return positions
          .map((p) => {
            if (p.isSpace) {
              return ' ';
            }
            if (p.isRevealed) {
              return text[p.index];
            }
            return nonSpaceChars[charIndex++];
          })
          .join('');
      } else {
        return text
          .split('')
          .map((char, i) => {
            if (char === ' ') {
              return ' ';
            }
            if (revealedIndicesRef.current.has(i)) {
              return text[i];
            }
            return availableChars[Math.floor(Math.random() * availableChars.length)];
          })
          .join('');
      }
    };

    if (isHovering) {
      setIsScrambling((prev) => {
        if (!prev) {
          return true;
        }
        return prev;
      });
      interval = setInterval(() => {
        if (sequential) {
          if (revealedIndicesRef.current.size < text.length) {
            const nextIndex = getNextIndex();
            revealedIndicesRef.current.add(nextIndex);
            setDisplayText((prev) => {
              const newText = shuffleText(text);
              return newText !== prev ? newText : prev;
            });
          } else {
            clearInterval(interval);
            setIsScrambling(false);
          }
        } else {
          setDisplayText((prev) => {
            const newText = shuffleText(text);
            return newText !== prev ? newText : prev;
          });
          currentIteration++;
          if (currentIteration >= maxIterations) {
            clearInterval(interval);
            setIsScrambling(false);
            setDisplayText(text);
          }
        }
      }, scrambleSpeed);
    } else {
      setDisplayText(prev => prev !== text ? text : prev);
      revealedIndicesRef.current.clear();
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isHovering, text, characters, scrambleSpeed, useOriginalCharsOnly, sequential, revealDirection, maxIterations]);

  return (
    <motion.span
      onHoverStart={() => setIsHovering?.(true)}
      onHoverEnd={() => setIsHovering?.(false)}
      className={cn('inline-block whitespace-pre-wrap', className)}
      {...props}
    >
      <span className="sr-only">{displayText}</span>
      <span aria-hidden="true">
        {displayText.split('').map((char, index) => (
          <span
            key={`${char}-${index}-${text}`}
            className={cn(revealedIndicesRef.current.has(index) || !isScrambling || !isHovering ? className : scrambledClassName)}
          >
            {char}
          </span>
        ))}
      </span>
    </motion.span>
  );
};

export default ScrambleHover;
