import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { GithubService } from './github.service';

/**
 * Cyberpunk Fixer system prompt. Kept short so it fits comfortably inside the
 * context window of small/cheap models. The downstream UI strips any leading
 * whitespace and renders the response as a styled "briefing".
 */
const FIXER_SYSTEM_PROMPT =
  "You are a Cyberpunk Fixer briefing a Netrunner over an encrypted comm. " +
  "The Netrunner's build node has flatlined. Read the build log fragment and " +
  "explain — in 4-6 sentences of grimy, neon-soaked street slang — what went " +
  "wrong and what they should do to bring the node back online. Reference the " +
  "specific error you see in the log. Use cyberpunk terms (chrome, ICE, deck, " +
  "flatline, jacking in, etc.) sparingly so the technical advice stays clear.";

/** Maximum number of characters of log we ship to the LLM. Logs can be many
 *  megabytes, so we trim to the tail (where the failure usually is). */
const MAX_LOG_CHARS = 6000;

export interface FixerBrief {
  summary: string;
}

@Injectable({ providedIn: 'root' })
export class LlmService {
  private http = inject(HttpClient);
  private githubService = inject(GithubService);

  /**
   * Returns true when the user has supplied enough config for us to call
   * an LLM. We require at least an API key — endpoint and model fall back
   * to OpenAI defaults.
   */
  isConfigured(): boolean {
    const cfg = this.githubService.getConfig();
    return !!(cfg && cfg.llmApiKey && cfg.llmApiKey.trim().length > 0);
  }

  /**
   * Sends an error log fragment to an OpenAI-compatible chat completions
   * endpoint and returns a cyberpunk-Fixer-flavored briefing. Trims the log
   * to the tail so we send the most relevant section.
   */
  generateFixerBrief(errorLog: string): Observable<FixerBrief> {
    const cfg = this.githubService.getConfig();
    if (!cfg || !cfg.llmApiKey) {
      return throwError(() => new Error('LLM not configured'));
    }

    const endpoint =
      (cfg.llmEndpoint && cfg.llmEndpoint.trim()) ||
      'https://api.openai.com/v1/chat/completions';
    const model = (cfg.llmModel && cfg.llmModel.trim()) || 'gpt-4o-mini';

    const trimmed = this.trimLog(errorLog);

    const body = {
      model,
      messages: [
        { role: 'system', content: FIXER_SYSTEM_PROMPT },
        {
          role: 'user',
          content:
            'BUILD LOG FRAGMENT (tail):\n```\n' + trimmed + '\n```\n\n' +
            "Brief me, choom — why did the node flatline?",
        },
      ],
      temperature: 0.8,
    };

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.llmApiKey}`,
    });

    return this.http.post<ChatCompletionResponse>(endpoint, body, { headers }).pipe(
      map((res) => {
        const summary =
          res?.choices?.[0]?.message?.content?.trim() || '';
        if (!summary) {
          throw new Error('Empty response from LLM');
        }
        return { summary };
      }),
      catchError((err) => {
        const msg =
          (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string')
            ? err.message
            : 'LLM request failed';
        return throwError(() => new Error(msg));
      })
    );
  }

  private trimLog(log: string): string {
    if (!log) return '';
    if (log.length <= MAX_LOG_CHARS) return log;
    // Keep the tail — that's where the failure usually lives.
    return '... [earlier output truncated] ...\n' + log.slice(-MAX_LOG_CHARS);
  }
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
}
