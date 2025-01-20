'use client'

import React, { useEffect } from 'react'
import { Link as ScrollLink } from 'react-scroll'
import { MessageSquare, Bell, PieChart, ArrowRight } from 'lucide-react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

export default function KindKeeperLandingPage() {
  const { session } = useAuth()
  const router = useRouter()
  
  useEffect(() => {
    const header = document.getElementById('header');
    const logo = document.getElementById('logo');
    const scrollThreshold = 50;

    const handleScroll = () => {
      if (window.scrollY > scrollThreshold) {
        header?.classList.add('py-2');
        header?.classList.remove('py-4');
        logo?.classList.remove('md:text-4xl');
        logo?.classList.add('md:text-2xl');
      } else {
        header?.classList.remove('py-2');
        header?.classList.add('py-4');
        logo?.classList.add('md:text-4xl');
        logo?.classList.remove('md:text-2xl');
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Redirect if already authenticated
  useEffect(() => {
    if (session) {
      router.push('/dashboard')
    }
  }, [session, router])

  return (
    <div className="min-h-screen font-sans">
      {/* Navigation */}
      <nav className="bg-gradient-to-r from-[#4A3B32] to-[#5C4B3F] text-white sticky top-0 z-50 transition-all duration-300" id="header">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="text-2xl md:text-4xl font-bold transition-all duration-300" id="logo">KindKeeper</div>
            <div className="hidden md:flex space-x-8">
              {['How It Works', 'Testimonials', 'Contact'].map((item) => (
                <ScrollLink
                  key={item}
                  to={item.toLowerCase().replace(' ', '-')}
                  smooth={true}
                  duration={500}
                  className="text-white/90 hover:text-white transition-colors cursor-pointer text-lg"
                >
                  {item}
                </ScrollLink>
              ))}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative bg-[#4A3B32] text-white min-h-[90vh] flex items-center">
        <div className="absolute inset-0 overflow-hidden">
          <Image
            src="/images/hero-bg.png"
            alt="Background"
            fill
            priority
            className="object-cover opacity-80"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-br from-[#4A3B32] via-[#5C4B3F]/90 to-[#8B7355]/80" />
        <div className="container mx-auto px-6 py-24 relative">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
                Managing Your Finances Has Never Been Easier
              </h1>
              <p className="text-xl md:text-2xl mb-8 text-white/90">
                Speak to track your expenses, set reminders, and stay in control effortlessly.
              </p>
              <button 
                onClick={() => router.push('/login')}
                className="group bg-gradient-to-r from-[#C4A484] to-[#967259] px-8 py-4 rounded-lg text-lg font-semibold hover:from-[#967259] hover:to-[#C4A484] transition-all duration-300 flex items-center gap-2"
              >
                Get Started Today
                <ArrowRight className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
            <div className="relative h-[400px] rounded-2xl overflow-hidden shadow-2xl hidden md:block">
              <Image
                src="/images/hero-image.png"
                alt="Senior couple smiling while using tablet together"
                fill
                priority
                quality={100}
                className="object-cover object-center"
              />
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 bg-gradient-to-b from-[#4A3B32] to-[#5C4B3F]">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="relative h-[500px] rounded-2xl overflow-hidden shadow-2xl">
              <Image
                src="/images/senior-couple.png"
                alt="Senior couple using KindKeeper financial app"
                fill
                className="object-cover"
                objectPosition="center center"
              />
            </div>
            <div className="text-white">
              <h2 className="text-4xl font-bold mb-6">Simple. Intuitive. Powerful.</h2>
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="bg-gradient-to-br from-[#C4A484] to-[#967259] rounded-full p-2 h-fit">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Voice Commands</h3>
                    <p className="text-white/90">Just speak naturally to record expenses or check your balance.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="bg-gradient-to-br from-[#C4A484] to-[#967259] rounded-full p-2 h-fit">
                    <Bell className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Smart Reminders</h3>
                    <p className="text-white/90">Never miss a payment with customizable voice alerts.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="bg-gradient-to-br from-[#C4A484] to-[#967259] rounded-full p-2 h-fit">
                    <PieChart className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Visual Reports</h3>
                    <p className="text-white/90">See your finances clearly with easy-to-read charts.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonial Section */}
      <section id="testimonials" className="py-24 bg-gradient-to-b from-[#4A3B32] to-[#5C4B3F]">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <div className="bg-gradient-to-br from-[#C4A484] to-[#967259] p-12 rounded-2xl shadow-2xl relative overflow-hidden">
              <div className="absolute inset-0 opacity-10">
                <Image
                  src="/images/hero-image.png"
                  alt="Background"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="relative">
                <blockquote className="text-white text-center">
                  <p className="text-2xl italic mb-6">
                    &ldquo;KindKeeper has transformed the way I manage my finances. It&apos;s so easy to use, and I love being able to track my expenses just by talking!&rdquo;
                  </p>
                  <footer className="font-semibold text-white/90">- Mary Johnson, Retired Teacher</footer>
                </blockquote>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="bg-gradient-to-b from-[#4A3B32] to-[#3A2B22] text-white py-16">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-start gap-8">
            <div>
              <h2 className="text-3xl font-bold mb-2">KindKeeper</h2>
              <p className="text-white/90 text-lg">Your Voice-Powered Personal Finance Assistant</p>
            </div>
            <div className="grid gap-2">
              <h3 className="text-xl font-semibold mb-2">Contact Us</h3>
              <p className="text-white/90">Email: support@kindkeeper.com</p>
              <p className="text-white/90">Phone: 123-456-7890</p>
            </div>
          </div>
          <div className="border-t border-white/10 mt-12 pt-8 text-center text-white/70">
            <p>&copy; 2024 KindKeeper. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
} 