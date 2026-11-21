import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { ApiService, Technology } from './api.service';
@Component({ selector: 'app-root', standalone: true, imports: [FormsModule, ReactiveFormsModule], templateUrl: './app.component.html' })
export class AppComponent {
  api = inject(ApiService);
  private fb = inject(FormBuilder);
  registering = signal(false);
  initializing = signal(true);
  busy = signal(false);
  loading = signal(false);
  message = signal('');
  error = signal('');
  items = signal<Technology[]>([]);
  editing = signal<number | null>(null);
  search = '';
  bases = ['PHP','C#','JavaScript','TypeScript','Java','Python','Outra'];
  totalHours = computed(() => this.items().reduce((sum, item) => sum + item.learningHours, 0));
  authForm = this.fb.nonNullable.group({
    name: [''], email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    password: ['', [Validators.required, Validators.minLength(8)]]
  });
  techForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    base: ['JavaScript', Validators.required],
    learningHours: [40, [Validators.required, Validators.min(1), Validators.max(100000), Validators.pattern(/^\d+$/)]]
  });
  constructor() {
    if (this.api.token()) this.api.me().pipe(finalize(() => this.initializing.set(false))).subscribe({
      next: () => this.load(), error: () => { this.api.logout(); this.error.set('Sessão indisponível. Entre novamente.'); }
    });
    else this.initializing.set(false);
  }
  clearMessages() { this.error.set(''); this.message.set(''); }
  switchMode() {
    this.registering.update(value => !value);
    this.authForm.controls.name.setValidators(this.registering() ? [Validators.required, Validators.minLength(2), Validators.maxLength(100)] : []);
    this.authForm.controls.name.updateValueAndValidity();
    this.clearMessages();
  }
  authenticate() {
    this.clearMessages();
    if (this.authForm.invalid || this.busy()) { this.authForm.markAllAsTouched(); return; }
    this.busy.set(true);
    const { name, email, password } = this.authForm.getRawValue();
    const request = this.registering() ? this.api.register(name, email, password) : this.api.login(email, password);
    request.pipe(finalize(() => this.busy.set(false))).subscribe({
      next: () => { this.authForm.reset(); this.items.set([]); this.reset(); this.load(); },
      error: error => this.showError(error)
    });
  }
  load() {
    this.loading.set(true);
    this.api.list(this.search).pipe(finalize(() => this.loading.set(false))).subscribe({ next: items => this.items.set(items), error: e => this.showError(e) });
  }
  save() {
    this.clearMessages();
    if (this.techForm.invalid || this.busy()) { this.techForm.markAllAsTouched(); return; }
    const value = this.techForm.getRawValue();
    const id = this.editing();
    this.busy.set(true);
    const request = id === null ? this.api.create(value) : this.api.update(id, value);
    request.pipe(finalize(() => this.busy.set(false))).subscribe({
      next: () => { this.message.set(id === null ? 'Tecnologia cadastrada!' : 'Tecnologia atualizada!'); this.reset(); this.load(); },
      error: e => this.showError(e)
    });
  }
  edit(item: Technology) {
    this.clearMessages(); this.editing.set(item.id);
    this.techForm.setValue({ name: item.name, base: item.base, learningHours: item.learningHours });
    document.getElementById('technology-name')?.focus();
  }
  reset() { this.editing.set(null); this.techForm.reset({ name: '', base: 'JavaScript', learningHours: 40 }); }
  remove(item: Technology) {
    if (this.busy() || !confirm(`Excluir a tecnologia "${item.name}"?`)) return;
    this.clearMessages(); this.busy.set(true);
    this.api.remove(item.id).pipe(finalize(() => this.busy.set(false))).subscribe({
      next: () => { if (this.editing() === item.id) this.reset(); this.message.set('Tecnologia excluída.'); this.load(); },
      error: e => this.showError(e)
    });
  }
  logout() { this.api.logout(); this.items.set([]); this.search = ''; this.reset(); this.clearMessages(); }
  showError(error: { error?: { message?: string } }) { this.error.set(error.error?.message || 'Não foi possível concluir. Verifique se a API está funcionando.'); }
}
