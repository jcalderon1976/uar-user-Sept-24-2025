import { ComponentFixture, TestBed } from '@angular/core/testing';
import { confirmRidePage } from './confirmRide.page';

describe('confirmRidePage', () => {
  let component: confirmRidePage;
  let fixture: ComponentFixture<confirmRidePage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(confirmRidePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
