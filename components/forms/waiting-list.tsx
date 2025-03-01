import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export default function Component() {
  return (
    <div className="flex h-screen items-center justify-center bg-[#050505]">
      <div className="w-full max-w-md space-y-6 rounded-lg bg-[#D8E4FF] p-8 shadow-lg">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Join the Waitlist</h1>
          <p className="text-[#6B818C]">
            Be the first to know when we launch our new product.
          </p>
        </div>
        <form className="space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" placeholder="Enter your name" />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" placeholder="Enter your email" type="email" />
          </div>
          <div>
            <Label htmlFor="comments">Comments</Label>
            <Textarea id="comments" placeholder="Any additional comments" />
          </div>
          <Button className="w-full" type="submit">
            Join Waitlist
          </Button>
        </form>
      </div>
    </div>
  )
}
