export class HistoryManager {
  private history: string[] = [];
  private index: number = 0;
  private currentDraft: string = '';
  private storageKey = 'wasmvm_shell_history';
  private maxEntries = 500;

  constructor() {
    this.load();
  }

  private load(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const data = localStorage.getItem(this.storageKey);
        if (data) {
          this.history = JSON.parse(data);
          this.index = this.history.length;
        }
      } catch (e) {
        console.warn('Failed to load history from localStorage:', e);
      }
    }
  }

  private save(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(this.storageKey, JSON.stringify(this.history.slice(-this.maxEntries)));
      } catch (e) {
        console.warn('Failed to save history to localStorage:', e);
      }
    }
  }

  public push(command: string): void {
    const trimmed = command.trim();
    if (!trimmed) return;

    // 前のコマンドと同じなら連続重複させない
    if (this.history.length === 0 || this.history[this.history.length - 1] !== trimmed) {
      this.history.push(trimmed);
      if (this.history.length > this.maxEntries) {
        this.history.shift();
      }
      this.save();
    }
    this.index = this.history.length;
    this.currentDraft = '';
  }

  public getPrevious(currentInput: string): string | null {
    if (this.index === this.history.length) {
      this.currentDraft = currentInput;
    }
    if (this.index > 0) {
      this.index--;
      return this.history[this.index];
    }
    return null;
  }

  public getNext(): string | null {
    if (this.index < this.history.length - 1) {
      this.index++;
      return this.history[this.index];
    } else if (this.index === this.history.length - 1) {
      this.index = this.history.length;
      return this.currentDraft;
    }
    return null;
  }

  public getAll(): string[] {
    return [...this.history];
  }

  public clear(): void {
    this.history = [];
    this.index = 0;
    this.currentDraft = '';
    this.save();
  }
}
