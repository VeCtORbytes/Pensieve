export type Locator = {
  charStart: number;
  charEnd: number;
  page?: number;
  startSec?: number;
  endSec?: number;
  heading?: string;
};

export type Segment = {
  text: string;
  locator: Locator;
};

export type Extraction = {
  rawText: string;
  segments: Segment[];
};

export type Chunk = {
  text: string;
  chunkIndex: number;
  locator: Locator;
};
