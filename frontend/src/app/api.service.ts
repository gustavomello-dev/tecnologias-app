import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError, tap } from 'rxjs';
export interface User { id: number; name: string; email: string; }
export interface Technology { id: number; name: string; base: string; learningHours: number; createdAt: string; updatedAt: string; }
export type TechnologyInput = Pick<Technology, 'name' | 'base' | 'learningHours'>;
interface AuthResponse { token: string; user: User; }
@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  token = signal<string | null>(sessionStorage.getItem('tech-token'));
  user = signal<User | null>(null);
  private accept = (result: AuthResponse) => {
    sessionStorage.setItem('tech-token', result.token);
    this.token.set(result.token); this.user.set(result.user);
  };
  login(email: string, password: string) { return this.http.post<AuthResponse>('/api/auth/login', { email, password }).pipe(tap(this.accept)); }
  register(name: string, email: string, password: string) { return this.http.post<AuthResponse>('/api/auth/register', { name, email, password }).pipe(tap(this.accept)); }
  me() { return this.http.get<User>('/api/auth/me').pipe(tap(user => this.user.set(user))); }
  logout() { sessionStorage.removeItem('tech-token'); this.token.set(null); this.user.set(null); }
  list(search = '') { return this.http.get<Technology[]>('/api/technologies', { params: { search } }); }
  create(body: TechnologyInput) { return this.http.post<Technology>('/api/technologies', body); }
  update(id: number, body: TechnologyInput) { return this.http.put<Technology>(`/api/technologies/${id}`, body); }
  remove(id: number) { return this.http.delete<void>(`/api/technologies/${id}`); }
}
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const api = inject(ApiService);
  const protectedRequest = req.url.startsWith('/api/') && !['/api/auth/login','/api/auth/register'].includes(req.url);
  const token = api.token();
  const request = protectedRequest && token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  return next(request).pipe(catchError(error => {
    if (protectedRequest && error.status === 401) api.logout();
    return throwError(() => error);
  }));
};
