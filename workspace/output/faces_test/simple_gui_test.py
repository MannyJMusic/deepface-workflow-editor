#!/usr/bin/env python3
"""
Simple GUI test to verify tkinter works
"""
import tkinter as tk
from tkinter import messagebox
import sys

def show_message():
    messagebox.showinfo("Test", "GUI is working!")

def main():
    root = tk.Tk()
    root.title("GUI Test")
    root.geometry("400x300")
    
    # Make sure window is on top
    root.lift()
    root.attributes('-topmost', True)
    root.after_idle(lambda: root.attributes('-topmost', False))
    
    label = tk.Label(root, text="GUI Test Window", font=("Arial", 16))
    label.pack(pady=20)
    
    button = tk.Button(root, text="Click Me!", command=show_message, font=("Arial", 12))
    button.pack(pady=10)
    
    # Auto-close after 10 seconds
    root.after(10000, root.quit)
    
    print("GUI window should be visible now!")
    root.mainloop()
    print("GUI test completed!")

if __name__ == "__main__":
    main()
