import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { ApplicationForm } from './application-form';

describe('ApplicationForm', () => {
  let component: ApplicationForm;
  let fixture: ComponentFixture<ApplicationForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ApplicationForm, RouterTestingModule]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ApplicationForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
